import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const BusinessContext = createContext(null)

// Defaults match the current hardcoded values so nothing breaks before the table is seeded
const DEFAULTS = {
  business_name: 'Sweet Red Peach',
  city:          'Carson',
  sms_ready:     `🎉 Your {business} order is READY, {name}! Come pick up anytime — we'll have it waiting.`,
  sms_pickup:    `Thanks for visiting {business}, {name}! We hope you love every bite. See you next time!`,
}

export function BusinessProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading]   = useState(true)

  const load = async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('*')
      .limit(1)
      .single()
    if (data) setSettings({ ...DEFAULTS, ...data })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async (updates) => {
    const merged = { ...settings, ...updates }
    setSettings(merged)
    // Upsert — table always has a single row with id = 1
    await supabase
      .from('business_settings')
      .upsert({ id: 1, ...merged })
  }

  // Interpolate a template: replace {name} and {business}
  const formatSms = (template, customerName) => {
    const firstName = customerName.split(' ')[0]
    const businessFull = settings.city
      ? `${settings.business_name} ${settings.city}`
      : settings.business_name
    return template
      .replace(/\{name\}/g, firstName)
      .replace(/\{business\}/g, businessFull)
  }

  const readySms   = (customerName) => formatSms(settings.sms_ready,   customerName)
  const pickupSms  = (customerName) => formatSms(settings.sms_pickup,  customerName)

  return (
    <BusinessContext.Provider value={{ settings, loading, save, readySms, pickupSms }}>
      {children}
    </BusinessContext.Provider>
  )
}

export const useBusiness = () => useContext(BusinessContext)

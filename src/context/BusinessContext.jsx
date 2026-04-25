import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useCurrentLocation } from './LocationContext'

const BusinessContext = createContext(null)

const DEFAULTS = {
  business_name: 'Sweet Red Peach',
  city:          'Carson',
  sms_ready:     `🎉 Your {business} order is READY, {name}! Come pick up anytime — we'll have it waiting.`,
  sms_pickup:    `Thanks for visiting {business}, {name}! We hope you love every bite. See you next time!`,
}

export function BusinessProvider({ children }) {
  const { currentLocation } = useCurrentLocation() || {}
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading]   = useState(true)

  const load = async () => {
    let query = supabase.from('business_settings').select('*')

    // Scope to the current location when available; fall back to id=1 for
    // backward compat during the migration window (before backfill runs).
    if (currentLocation?.id) {
      query = query.eq('location_id', currentLocation.id)
    } else {
      query = query.eq('id', 1)
    }

    const { data } = await query.limit(1).maybeSingle()
    if (data) setSettings({ ...DEFAULTS, ...data })
    setLoading(false)
  }

  useEffect(() => { load() }, [currentLocation?.id])

  const save = async (updates) => {
    const merged = { ...settings, ...updates }
    setSettings(merged)

    if (currentLocation?.id) {
      // Per-location row: upsert keyed on location_id
      await supabase.from('business_settings').upsert({
        ...merged,
        location_id: currentLocation.id,
      })
    } else {
      // Pre-migration fallback: single row with id=1
      await supabase.from('business_settings').upsert({ id: 1, ...merged })
    }
  }

  const formatSms = (template, customerName) => {
    const firstName = customerName.split(' ')[0]
    const businessFull = settings.city
      ? `${settings.business_name} ${settings.city}`
      : settings.business_name
    return template
      .replace(/\{name\}/g, firstName)
      .replace(/\{business\}/g, businessFull)
  }

  const readySms  = (customerName) => formatSms(settings.sms_ready,  customerName)
  const pickupSms = (customerName) => formatSms(settings.sms_pickup, customerName)

  return (
    <BusinessContext.Provider value={{ settings, loading, save, readySms, pickupSms }}>
      {children}
    </BusinessContext.Provider>
  )
}

export const useBusiness = () => useContext(BusinessContext)

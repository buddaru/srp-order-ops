import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MENU, CATEGORIES } from '../data/menuData'

// Per-location cache so each location's menu is fetched once per session
const _cache = {}

export function useMenuItems(locationId) {
  const cached = locationId ? _cache[locationId] : null
  const [menuItems, setMenuItems] = useState(cached || MENU)
  const [loading, setLoading]     = useState(!cached)

  useEffect(() => {
    if (!locationId) { setLoading(false); return }
    if (_cache[locationId]) { setMenuItems(_cache[locationId]); setLoading(false); return }
    supabase
      .from('menu_items')
      .select('*')
      .eq('active', true)
      .eq('location_id', locationId)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          _cache[locationId] = data
          setMenuItems(data)
        }
        setLoading(false)
      })
  }, [locationId])

  // Derive categories from loaded items, preserving canonical order
  const categories = CATEGORIES.filter(cat => menuItems.some(m => m.category === cat))
  menuItems.forEach(m => {
    if (!categories.includes(m.category)) categories.push(m.category)
  })

  return { menuItems, categories, loading }
}

// Call this to bust the cache after admin edits
export function invalidateMenuCache(locationId) {
  if (locationId) {
    delete _cache[locationId]
  } else {
    Object.keys(_cache).forEach(k => delete _cache[k])
  }
}

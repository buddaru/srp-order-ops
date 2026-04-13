import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MENU, CATEGORIES } from '../data/menuData'

// Module-level cache so the DB is only hit once per session
let _cache = null

export function useMenuItems() {
  const [menuItems, setMenuItems] = useState(_cache || MENU)
  const [loading, setLoading]     = useState(!_cache)

  useEffect(() => {
    if (_cache) return
    supabase
      .from('menu_items')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          _cache = data
          setMenuItems(data)
        }
        // If table is empty or errors, keep using static MENU as fallback
        setLoading(false)
      })
  }, [])

  // Derive categories from loaded items, preserving canonical order
  const categories = CATEGORIES.filter(cat => menuItems.some(m => m.category === cat))
  // Add any extra categories from DB that aren't in the static list
  menuItems.forEach(m => {
    if (!categories.includes(m.category)) categories.push(m.category)
  })

  return { menuItems, categories, loading }
}

// Call this to bust the cache after admin edits
export function invalidateMenuCache() {
  _cache = null
}

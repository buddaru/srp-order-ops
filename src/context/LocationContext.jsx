import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const { user } = useAuth()
  const { locationSlug } = useParams()

  const [locations, setLocations]               = useState([])
  const [orgMemberships, setOrgMemberships]     = useState([])
  const [locationMemberships, setLocationMemberships] = useState([])
  const [loading, setLoading]                   = useState(true)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      const [orgRes, locRes] = await Promise.all([
        supabase.from('organization_members').select('organization_id, role').eq('user_id', user.id),
        supabase.from('location_members').select('location_id, role').eq('user_id', user.id),
      ])

      const orgMems = orgRes.data || []
      const locMems = locRes.data || []
      setOrgMemberships(orgMems)
      setLocationMemberships(locMems)

      const orgIds      = orgMems.map(m => m.organization_id)
      const directLocIds = locMems.map(m => m.location_id)

      let allLocs = []
      if (orgIds.length > 0) {
        const { data } = await supabase.from('locations').select('*').in('organization_id', orgIds)
        allLocs = data || []
      }
      if (directLocIds.length > 0) {
        const { data } = await supabase.from('locations').select('*').in('id', directLocIds)
        for (const loc of (data || [])) {
          if (!allLocs.find(l => l.id === loc.id)) allLocs.push(loc)
        }
      }

      setLocations(allLocs)
    } catch (e) {
      console.warn('LocationContext load error:', e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  // The current location is the one whose slug matches the URL param.
  // Falls back to the first accessible location when slug isn't in the URL
  // (e.g. privacy/terms pages rendered outside the /app/:locationSlug route).
  const currentLocation = locationSlug
    ? (locations.find(l => l.slug === locationSlug) ?? null)
    : (locations[0] ?? null)

  // Returns the user's effective role string at a given location id.
  const effectiveRole = useCallback((locationId) => {
    const loc     = locations.find(l => l.id === locationId)
    const orgMem  = orgMemberships.find(m => m.organization_id === loc?.organization_id)
    if (orgMem) return orgMem.role  // 'org_owner' | 'org_admin'
    const locMem  = locationMemberships.find(m => m.location_id === locationId)
    return locMem?.role ?? null     // 'manager' | 'employee' | null
  }, [locations, orgMemberships, locationMemberships])

  const isLocationAdmin = currentLocation
    ? ['org_owner', 'org_admin', 'manager'].includes(effectiveRole(currentLocation.id))
    : false

  return (
    <LocationContext.Provider value={{
      locations,
      currentLocation,
      orgMemberships,
      locationMemberships,
      loading,
      isLocationAdmin,
      effectiveRole,
      reload: load,
    }}>
      {children}
    </LocationContext.Provider>
  )
}

export const useCurrentLocation = () => useContext(LocationContext)

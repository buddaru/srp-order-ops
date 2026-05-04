import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuth } from './context/AuthContext'
import { LocationProvider } from './context/LocationContext'
import { BusinessProvider } from './context/BusinessContext'
import LocationApp from './LocationApp'
import Login from './components/Login'
import Privacy from './components/Privacy'
import Terms from './components/Terms'

// Mounted under /app/:locationSlug/* — wraps location-aware context providers.
function LocationShell() {
  return (
    <LocationProvider>
      <BusinessProvider>
        <LocationApp />
      </BusinessProvider>
    </LocationProvider>
  )
}

// Loads the user's first accessible location and redirects there.
// Shown for any path that doesn't match /app/:locationSlug/* (including root /).
function RootRedirect() {
  const { user, loading, orgMemberships, locationMemberships } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || !user) return
    async function redirect() {
      let slug = null

      // Use memberships already fetched by AuthContext — no extra queries needed.
      const orgIds       = orgMemberships.map(m => m.organization_id)
      const directLocIds = locationMemberships.map(m => m.location_id)

      if (orgIds.length) {
        const { data: locs } = await supabase
          .from('locations')
          .select('slug')
          .in('organization_id', orgIds)
          .order('created_at', { ascending: true })
          .limit(1)
        slug = locs?.[0]?.slug ?? null
      }

      if (!slug && directLocIds.length) {
        const { data: locs } = await supabase
          .from('locations')
          .select('slug')
          .in('id', directLocIds)
          .limit(1)
        slug = locs?.[0]?.slug ?? null
      }

      if (slug) {
        navigate(`/app/${slug}/orders`, { replace: true })
      }
      // If no location found yet (tables pre-migration), stay on loading screen.
    }
    redirect()
  }, [user, loading, orgMemberships, locationMemberships])

  if (!user) return <Login />
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontFamily: 'sans-serif' }}>Loading…</div>
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Login />

  return (
    <Routes>
      {/* Public routes — no location context needed */}
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms"   element={<Terms />} />

      {/* Location-scoped app */}
      <Route path="/app/:locationSlug/*" element={<LocationShell />} />

      {/* Everything else (including /) → find first location and redirect */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}

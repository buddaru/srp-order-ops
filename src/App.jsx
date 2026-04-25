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
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    async function redirect() {
      let slug = null

      // Try org membership first (org_owner → all org locations)
      const { data: orgMems } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)

      if (orgMems?.length) {
        const { data: locs } = await supabase
          .from('locations')
          .select('slug')
          .eq('organization_id', orgMems[0].organization_id)
          .order('created_at', { ascending: true })
          .limit(1)
        slug = locs?.[0]?.slug ?? null
      }

      // Fall back to direct location membership
      if (!slug) {
        const { data: locMems } = await supabase
          .from('location_members')
          .select('location_id, locations(slug)')
          .eq('user_id', user.id)
          .limit(1)
        slug = locMems?.[0]?.locations?.slug ?? null
      }

      if (slug) {
        navigate(`/app/${slug}/orders`, { replace: true })
      }
      // If no location found yet (tables pre-migration), stay on loading screen.
    }
    redirect()
  }, [user])

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

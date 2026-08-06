import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ActivityDetailScreen, ActivityListScreen } from '../features/activity/ActivityScreens'
import { CategoriesScreen, MoreScreen, ProfileScreen, SyncIssuesScreen, SystemStatesScreen } from '../features/more/MoreScreens'
import { NewRecipeScreen, RecipeEditorScreen } from '../features/recipes/RecipeEditorScreens'
import { CookPreviewScreen, CookingResultScreen, RecipeDetailScreen, RecipeListScreen } from '../features/recipes/RecipeScreens'
import { AddStockScreen, CatalogScreen, CreateIngredientScreen, PantryScreen } from '../features/pantry/screens'
import WelcomePage from '../features/marketing/WelcomePage'
import { BasketScreen, GroceriesScreen, GroceryListScreen } from '../features/groceries/GroceryScreens'
import { RouteTransitionManager } from '../shared/ui/RouteTransitionManager'
import { GroceaLoadingSplash } from '../shared/ui/GroceaLoadingSplash'
import { GroceaProvider } from './GroceaProvider'
import { AuthProvider, useAuth } from './auth-context'
import { createGroceaStorage, deleteLegacyStorage, legacyStorageExists, migrateLegacyStorage } from './persistence'
import { AuthScreen } from '../features/auth/AuthScreens'
import '../styles/app.css'

export default function App() {
  return <AuthProvider><RouteTransitionManager /><Routes>
    <Route path="/welcome" element={<WelcomePage />} />
    <Route path="/login" element={<PublicAuthRoute mode="login" />} />
    <Route path="/register" element={<PublicAuthRoute mode="register" />} />
    <Route path="*" element={<ProtectedRoutes />} />
  </Routes></AuthProvider>
}

function PublicAuthRoute({ mode }: { mode: 'login' | 'register' }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <AuthLoading />
  if (status === 'authenticated' || status === 'offline-authenticated') {
    const returnTo = safeReturnTo(new URLSearchParams(location.search).get('returnTo'))
    return <Navigate to={returnTo} replace />
  }
  return <AuthScreen mode={mode} />
}

function ProtectedRoutes() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <AuthLoading />
  if (status === 'unavailable') {
    return <main className="storage-state"><div className="storage-state-card"><span className="eyebrow">CONNECTION REQUIRED</span><h1>Sign in to open Grocea</h1><p>Grocea needs one server-confirmed sign-in before it can create an account cache.</p><a className="button primary" href="/login">Go to sign in</a></div></main>
  }
  if (status === 'anonymous') {
    const target = safeReturnTo(`${location.pathname}${location.search}${location.hash}`)
    return <Navigate to={`/login?returnTo=${encodeURIComponent(target)}`} replace />
  }
  return <GroceaApp />
}

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/pantry'
  if (value === '/login' || value === '/register' || value === '/welcome') return '/pantry'
  return value
}

function AuthLoading() {
  return <GroceaLoadingSplash />
}

function GroceaApp() {
  const { account } = useAuth()
  if (!account) return <AuthLoading />
  return <AccountGroceaApp userId={account.id} />
}

function AccountGroceaApp({ userId }: { userId: string }) {
  const storage = useMemo(() => createGroceaStorage(userId), [userId])
  const [legacyStatus, setLegacyStatus] = useState<'checking' | 'none' | 'needs-choice' | 'error'>('checking')
  const [legacyError, setLegacyError] = useState<string | null>(null)
  const [migrationPending, setMigrationPending] = useState(false)
  useEffect(() => {
    let active = true
    void legacyStorageExists().then(exists => { if (active) setLegacyStatus(exists ? 'needs-choice' : 'none') }).catch(error => {
      if (active) { setLegacyError(error instanceof Error ? error.message : 'Legacy local data could not be inspected.'); setLegacyStatus('error') }
    })
    return () => { active = false }
  }, [userId])
  useEffect(() => {
    const purge = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail
      if (!detail?.userId || detail.userId === userId) void storage.destroy?.()
    }
    window.addEventListener('grocea:purge-account-cache', purge)
    return () => {
      window.removeEventListener('grocea:purge-account-cache', purge)
      storage.close?.()
    }
  }, [storage, userId])
  if (legacyStatus === 'checking') return <main className="storage-state" aria-busy="true"><div className="storage-state-card"><span className="eyebrow">LOCAL DATA</span><h1>Checking for existing data…</h1><p>Grocea will never attach old local data to an account without your choice.</p></div></main>
  if (legacyStatus === 'error') return <main className="storage-state"><div className="storage-state-card"><span className="eyebrow">LOCAL DATA ERROR</span><h1>Existing local data needs attention</h1><p>{legacyError}</p><button className="button primary" type="button" onClick={() => window.location.reload()}>Try again</button></div></main>
  if (legacyStatus === 'needs-choice') return <LegacyMigrationGate pending={migrationPending} onMove={async () => { setMigrationPending(true); try { await migrateLegacyStorage(userId); setLegacyStatus('none') } catch (error) { setLegacyError(error instanceof Error ? error.message : 'Local data could not be moved.'); setLegacyStatus('error') } finally { setMigrationPending(false) } }} onDelete={async () => { setMigrationPending(true); try { await deleteLegacyStorage(userId); setLegacyStatus('none') } catch (error) { setLegacyError(error instanceof Error ? error.message : 'Local data could not be deleted.'); setLegacyStatus('error') } finally { setMigrationPending(false) } }} />
  return <GroceaProvider storage={storage}><Routes>
    <Route path="/" element={<Navigate to="/pantry" replace />} />
    <Route path="/pantry" element={<PantryScreen />} />
    <Route path="/pantry/stock/new" element={<AddStockScreen />} />
    <Route path="/ingredients" element={<CatalogScreen />} />
    <Route path="/ingredients/new" element={<CreateIngredientScreen />} />
    <Route path="/recipes" element={<RecipeListScreen />} />
    <Route path="/recipes/basket" element={<BasketScreen />} />
    <Route path="/recipes/new" element={<NewRecipeScreen />} />
    <Route path="/recipes/:id/edit/:stage" element={<RecipeEditorScreen />} />
    <Route path="/recipes/:recipeId/ingredients/new" element={<CreateIngredientScreen />} />
    <Route path="/recipes/:id" element={<RecipeDetailScreen />} />
    <Route path="/recipes/:id/cook" element={<CookPreviewScreen />} />
    <Route path="/recipes/:id/complete/:eventId" element={<CookingResultScreen />} />
    <Route path="/activity" element={<ActivityListScreen />} />
    <Route path="/activity/:id" element={<ActivityDetailScreen />} />
    <Route path="/more" element={<MoreScreen />} />
    <Route path="/groceries" element={<GroceriesScreen />} />
    <Route path="/groceries/:id" element={<GroceryListScreen />} />
    <Route path="/categories" element={<CategoriesScreen />} />
    <Route path="/profile" element={<ProfileScreen />} />
    {import.meta.env.DEV && <Route path="/system-states" element={<SystemStatesScreen />} />}
    <Route path="/sync-issues" element={<SyncIssuesScreen />} />
    <Route path="*" element={<Navigate to="/pantry" replace />} />
  </Routes></GroceaProvider>
}

function LegacyMigrationGate({ pending, onMove, onDelete }: { pending: boolean; onMove: () => Promise<void>; onDelete: () => Promise<void> }) {
  return <main className="storage-state"><div className="storage-state-card"><span className="eyebrow">ONE-TIME DATA CHOICE</span><h1>What should happen to your local kitchen?</h1><p>Grocea found data from an earlier local workspace. Choose whether to move it into this account or start with a clean kitchen.</p><div className="form-actions"><button className="button primary" type="button" disabled={pending} onClick={() => void onMove()}>{pending ? 'Moving…' : 'Move local data to this account'}</button><button className="button danger" type="button" disabled={pending} onClick={() => { if (window.confirm('Delete the old local data? A recovery copy will not be kept.')) void onDelete() }}>Delete local data and start fresh</button></div></div></main>
}

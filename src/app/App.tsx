import { Navigate, Route, Routes } from 'react-router-dom'
import { ActivityDetailScreen, ActivityListScreen } from '../features/activity/ActivityScreens'
import { CategoriesScreen, MoreScreen, ProfileScreen, SystemStatesScreen } from '../features/more/MoreScreens'
import { CookPreviewScreen, CookingResultScreen, RecipeDetailScreen, RecipeEditorScreen, RecipeListScreen } from '../features/recipes/RecipeScreens'
import { AddStockScreen, CatalogScreen, CreateIngredientScreen, PantryScreen } from '../pantry/screens'
import { GroceaProvider } from './GroceaProvider'
import '../styles/app.css'

export default function App() {
  return <GroceaProvider><Routes>
    <Route path="/" element={<Navigate to="/pantry" replace />} />
    <Route path="/pantry" element={<PantryScreen />} />
    <Route path="/pantry/stock/new" element={<AddStockScreen />} />
    <Route path="/ingredients" element={<CatalogScreen />} />
    <Route path="/ingredients/new" element={<CreateIngredientScreen />} />
    <Route path="/recipes" element={<RecipeListScreen />} />
    <Route path="/recipes/new" element={<RecipeEditorScreen />} />
    <Route path="/recipes/:id" element={<RecipeDetailScreen />} />
    <Route path="/recipes/:id/cook" element={<CookPreviewScreen />} />
    <Route path="/recipes/:id/complete/:eventId" element={<CookingResultScreen />} />
    <Route path="/activity" element={<ActivityListScreen />} />
    <Route path="/activity/:id" element={<ActivityDetailScreen />} />
    <Route path="/more" element={<MoreScreen />} />
    <Route path="/categories" element={<CategoriesScreen />} />
    <Route path="/profile" element={<ProfileScreen />} />
    <Route path="/system-states" element={<SystemStatesScreen />} />
    <Route path="*" element={<Navigate to="/pantry" replace />} />
  </Routes></GroceaProvider>
}

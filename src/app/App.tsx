import { Navigate, Route, Routes } from 'react-router-dom'
import { ActivityDetailScreen, ActivityListScreen } from '../features/activity/ActivityScreens'
import { CategoriesScreen, MoreScreen, ProfileScreen, SyncIssuesScreen, SystemStatesScreen } from '../features/more/MoreScreens'
import { NewRecipeScreen, RecipeEditorScreen } from '../features/recipes/RecipeEditorScreens'
import { CookPreviewScreen, CookingResultScreen, RecipeDetailScreen, RecipeListScreen } from '../features/recipes/RecipeScreens'
import { AddStockScreen, CatalogScreen, CreateIngredientScreen, PantryScreen } from '../features/pantry/screens'
import WelcomePage from '../features/marketing/WelcomePage'
import { BasketScreen, GroceriesScreen, GroceryListScreen } from '../features/groceries/GroceryScreens'
import { RouteTransitionManager } from '../shared/ui/RouteTransitionManager'
import { GroceaProvider } from './GroceaProvider'
import '../styles/app.css'

export default function App() {
  return <><RouteTransitionManager /><Routes>
    <Route path="/welcome" element={<WelcomePage />} />
    <Route path="*" element={<GroceaApp />} />
  </Routes></>
}

function GroceaApp() {
  return <GroceaProvider><Routes>
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

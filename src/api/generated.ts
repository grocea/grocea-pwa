// Generated from grocea-backend/openapi/openapi.json. Do not edit by hand.
export interface components {
  schemas: schemas
}

export interface schemas {
  "ActivityResponse": { "changes": Array<schemas["StockChangeResponse"]>; "detail": string; "id": string; "occurred_at": string; "recipe_id": string | null; "reversal_of": string | null; "reversed_at": string | null; "servings": number | null; "title": string; "type": "cooking" | "manual" | "reversal" }
  "BasketItemResponse": { "base_servings": number; "error": string | null; "recipe_id": string; "recipe_name": string; "servings": number; "valid": boolean }
  "BasketItemUpsert": { "servings": number }
  "BasketResponse": { "items": Array<schemas["BasketItemResponse"]> }
  "CategoryCreate": { "id"?: string | null; "name": string }
  "CategoryResponse": { "archived_at": string | null; "created_at": string; "id": string; "name": string; "scope": schemas["Scope"]; "updated_at": string }
  "CategoryUpdate": { "name": string }
  "CookRecipeCreate": { "event_id": string; "servings": number }
  "ErrorResponse": { "code": string; "details": { [key: string]: unknown }; "message": string; "request_id": string }
  "GroceryListBasisIngredient": { "ingredient_id": string; "quantity": number | string }
  "GroceryListComplete": { "event_id": string; "pantry_item_ids"?: Array<string> }
  "GroceryListCreate": { "generated_item_ids"?: Array<schemas["GroceryListGeneratedItemId"]>; "id": string; "pantry_basis"?: Array<schemas["GroceryListPantryBasis"]>; "recipe_basis"?: Array<schemas["GroceryListRecipeBasis"]>; "title"?: string | null }
  "GroceryListGeneratedItemId": { "id": string; "ingredient_id": string }
  "GroceryListItemCreate": { "id": string; "ingredient_id"?: string | null; "label": string; "quantity"?: number | string | null; "unit"?: string | null }
  "GroceryListItemResponse": { "category_name": string; "checked": boolean; "created_at": string; "edited": boolean; "id": string; "ingredient_id": string | null; "label": string; "measurement_family": schemas["MeasurementFamily"] | null; "origin": "generated" | "manual"; "original_pantry": string | null; "original_quantity": string | null; "original_required": string | null; "quantity": string | null; "sources": Array<schemas["GroceryListItemSourceResponse"]>; "unit": string | null; "updated_at": string }
  "GroceryListItemSourceResponse": { "quantity": string; "recipe_id": string; "recipe_name": string; "servings": number; "unit": schemas["Unit"] }
  "GroceryListItemUpdate": { "checked": boolean; "ingredient_id"?: string | null; "label": string; "quantity"?: number | string | null; "unit"?: string | null }
  "GroceryListPantryBasis": { "ingredient_id": string; "quantity": number | string }
  "GroceryListRecipeBasis": { "base_servings": number; "ingredients": Array<schemas["GroceryListBasisIngredient"]>; "recipe_id": string }
  "GroceryListRecipeResponse": { "base_servings": number; "recipe_id": string; "recipe_name": string; "servings": number }
  "GroceryListResponse": { "completed_at": string | null; "created_at": string; "id": string; "items": Array<schemas["GroceryListItemResponse"]>; "recipes": Array<schemas["GroceryListRecipeResponse"]>; "status": schemas["GroceryListStatus"]; "title": string; "updated_at": string }
  "GroceryListStatus": "active" | "completed"
  "GroceryListUpdate": { "title": string }
  "HealthResponse": { "status"?: "ok" }
  "ImportConflict": { "kind": string; "local_id": string; "message": string }
  "IngredientCreate": { "category_id": string; "id"?: string | null; "measurement_family": schemas["MeasurementFamily"]; "name": string; "track_in_pantry"?: boolean }
  "IngredientPage": { "items": Array<schemas["IngredientResponse"]>; "limit": number; "offset": number; "total": number }
  "IngredientResponse": { "archived_at": string | null; "category_id": string; "created_at": string; "id": string; "measurement_family": schemas["MeasurementFamily"]; "name": string; "scope": schemas["Scope"]; "tracked_in_pantry": boolean; "updated_at": string }
  "IngredientUpdate": { "category_id"?: string | null; "measurement_family"?: schemas["MeasurementFamily"] | null; "name"?: string | null }
  "LocalImportRequest": { "import_id": string; "state": { [key: string]: unknown } }
  "LocalImportResponse": { "conflicts": Array<schemas["ImportConflict"]>; "id_map": { [key: string]: string }; "revision": number }
  "MeasurementFamily": "mass" | "volume" | "count"
  "PantryStockResponse": { "created_at": string; "id": string; "ingredient_id": string; "quantity": string; "updated_at": string }
  "ProfileResponse": { "created_at": string; "display_name": string; "id": string; "measurement_system": "metric"; "preferred_servings": number | null; "updated_at": string }
  "ProfileUpdate": { "display_name"?: string | null; "preferred_servings"?: number | null }
  "RecipeCreate": { "base_servings": number; "description"?: string; "id": string; "ingredients"?: Array<schemas["RecipeIngredientWrite"]>; "name"?: string; "steps"?: Array<string> }
  "RecipeIngredientResponse": { "ingredient_id": string; "quantity": string | null; "quantity_input": string; "unit": schemas["Unit"] }
  "RecipeIngredientWrite": { "ingredient_id": string; "quantity"?: string; "unit": schemas["Unit"] }
  "RecipeResponse": { "base_servings": number; "created_at": string; "description": string; "id": string; "ingredients": Array<schemas["RecipeIngredientResponse"]>; "name": string; "scope": schemas["Scope"]; "status": schemas["RecipeStatus"]; "steps": Array<string>; "updated_at": string }
  "RecipeStatus": "draft" | "published"
  "RecipeUpdate": { "base_servings": number; "description": string; "ingredients": Array<schemas["RecipeIngredientWrite"]>; "name": string; "steps": Array<string> }
  "ReverseActivityCreate": { "event_id": string }
  "Scope": "global" | "custom"
  "ScopeFilter": "all" | "global" | "custom"
  "StateResponse": { "activity": Array<schemas["ActivityResponse"]>; "basket": schemas["BasketResponse"]; "categories": Array<schemas["CategoryResponse"]>; "grocery_lists": Array<schemas["GroceryListResponse"]>; "ingredients": Array<schemas["IngredientResponse"]>; "pantry_stocks": Array<schemas["PantryStockResponse"]>; "profile": schemas["ProfileResponse"]; "recipes": Array<schemas["RecipeResponse"]>; "revision": number }
  "StockChangeResponse": { "after": string; "before": string; "delta": string; "ingredient_id": string }
  "StockOperation": "add" | "set" | "remove"
  "StockOperationCreate": { "amount": number | string; "event_id": string; "operation": schemas["StockOperation"]; "reason"?: string }
  "Unit": "mg" | "g" | "kg" | "ml" | "L" | "item"
}

# Source layout

- `app/` owns routing, fixtures, and the in-memory application boundary.
- `domain/` contains shared product language and UI-facing domain types.
- `features/` groups screens by user capability: recipes, activity, and preferences.
- `pantry/` contains the Pantry and Ingredient Catalog slice.
- `shared/` contains reusable UI and exact quantity helpers.
- `styles/` contains responsive application styles and established component styles.

Feature code may depend on `domain` and `shared`. Shared code does not depend on features.

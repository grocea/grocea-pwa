import type { GroceaState } from '../domain/types'

export const initialState: GroceaState = {
  categories: [
    { id: 'produce', name: 'Produce', scope: 'global' },
    { id: 'dairy', name: 'Dairy & chilled', scope: 'global' },
    { id: 'pantry', name: 'Pantry staples', scope: 'global' },
    { id: 'bakery', name: 'Grains & bakery', scope: 'global' },
    { id: 'beverages', name: 'Beverages', scope: 'global' },
    { id: 'protein', name: 'Protein', scope: 'global' },
    { id: 'spices', name: 'Herbs & spices', scope: 'global' },
    { id: 'frozen', name: 'Frozen', scope: 'global' },
    { id: 'breakfast', name: 'Breakfast staples', scope: 'custom' },
    { id: 'local', name: 'Local favourites', scope: 'custom' },
  ],
  ingredients: [
    { id: 'rice', name: 'Basmati rice', categoryId: 'pantry', family: 'mass', scope: 'global' },
    { id: 'bananas', name: 'Bananas', categoryId: 'produce', family: 'count', scope: 'global' },
    { id: 'butter', name: 'Butter', categoryId: 'dairy', family: 'mass', scope: 'global' },
    { id: 'carrots', name: 'Carrots', categoryId: 'produce', family: 'count', scope: 'global' },
    { id: 'chickpeas', name: 'Chickpeas', categoryId: 'pantry', family: 'mass', scope: 'global' },
    { id: 'coffee', name: 'Coffee beans', categoryId: 'beverages', family: 'mass', scope: 'global' },
    { id: 'cucumber', name: 'Cucumber', categoryId: 'produce', family: 'count', scope: 'global' },
    { id: 'eggs', name: 'Eggs', categoryId: 'protein', family: 'count', scope: 'global' },
    { id: 'flour', name: 'Plain flour', categoryId: 'bakery', family: 'mass', scope: 'global' },
    { id: 'milk', name: 'Whole milk', categoryId: 'dairy', family: 'volume', scope: 'global' },
    { id: 'oats', name: 'Rolled oats', categoryId: 'breakfast', family: 'mass', scope: 'global' },
    { id: 'oil', name: 'Olive oil', categoryId: 'pantry', family: 'volume', scope: 'global' },
    { id: 'tomatoes', name: 'Tomatoes', categoryId: 'produce', family: 'count', scope: 'global' },
  ],
  balances: { rice: 2_400_000n, bananas: 0n, butter: 250_000n, carrots: 0n, chickpeas: 600_000n, coffee: -50_000n, cucumber: 0n, eggs: 8_000n, flour: 1_200_000n, milk: 1_500_000n, oats: 800_000n, oil: 750_000n, tomatoes: 2_000n },
  recipes: [
    { id: 'tomato-egg-rice', status: 'published', name: 'Tomato egg rice', description: 'A fast, comforting rice bowl with soft eggs and juicy tomatoes.', baseServings: 2, scope: 'global', ingredients: [{ ingredientId: 'rice', quantity: 300_000n, unit: 'g' }, { ingredientId: 'eggs', quantity: 2_000n, unit: 'item' }, { ingredientId: 'tomatoes', quantity: 3_000n, unit: 'item' }], steps: ['Cook the rice until tender.', 'Scramble the eggs and set aside.', 'Cook tomatoes, return eggs, and serve over rice.'] },
    { id: 'oat-porridge', status: 'published', name: 'Oat porridge', description: 'Creamy everyday oats.', baseServings: 1, scope: 'global', ingredients: [{ ingredientId: 'oats', quantity: 80_000n, unit: 'g' }, { ingredientId: 'milk', quantity: 250_000n, unit: 'ml' }], steps: ['Simmer oats and milk for 6 minutes.', 'Rest briefly, then serve.'] },
    { id: 'fried-rice', status: 'published', name: 'Vegetable fried rice', description: 'A quick pantry dinner.', baseServings: 2, scope: 'global', ingredients: [{ ingredientId: 'rice', quantity: 300_000n, unit: 'g' }, { ingredientId: 'eggs', quantity: 2_000n, unit: 'item' }, { ingredientId: 'carrots', quantity: 2_000n, unit: 'item' }], steps: ['Stir-fry vegetables.', 'Add rice and eggs, then season.'] },
    { id: 'chickpea-bowl', status: 'published', name: 'Chickpea bowl', description: 'Fresh chickpeas with cucumber.', baseServings: 2, scope: 'custom', ingredients: [{ ingredientId: 'chickpeas', quantity: 300_000n, unit: 'g' }, { ingredientId: 'cucumber', quantity: 1_000n, unit: 'item' }], steps: ['Drain chickpeas.', 'Chop cucumber and combine.'] },
  ],
  activity: [
    { id: 'manual-rice', type: 'manual', title: 'Added Basmati rice', detail: '+1 kg · Groceries', occurredAt: '2026-07-17T09:15:00+08:00', changes: [{ ingredientId: 'rice', before: 1_400_000n, delta: 1_000_000n, after: 2_400_000n }] },
    { id: 'manual-milk', type: 'manual', title: 'Set Whole milk', detail: '1.5 L · Manual adjustment', occurredAt: '2026-07-16T18:02:00+08:00', changes: [{ ingredientId: 'milk', before: 900_000n, delta: 600_000n, after: 1_500_000n }] },
  ],
  profile: { displayName: 'Ammar', measurementSystem: 'metric', preferredServings: 2 },
}

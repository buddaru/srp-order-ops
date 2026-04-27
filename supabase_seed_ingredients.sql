-- Seed the ingredients library from ingredient names already stored in recipes.
-- Extracts every unique ingredient name from recipes.ingredients JSONB,
-- inserts with default values (price=0, unit='oz') so cost tracking can be filled in.
-- Safe to run multiple times — ON CONFLICT DO NOTHING skips existing names.

insert into ingredients (name, purchase_unit, purchase_price, yield_pct)
select distinct
  trim(ing->>'name')  as name,
  'oz'                as purchase_unit,
  0                   as purchase_price,
  100                 as yield_pct
from recipes,
  jsonb_array_elements(
    case jsonb_typeof(ingredients)
      when 'array' then ingredients
      else '[]'::jsonb
    end
  ) as ing
where ing->>'type' = 'item'
  and trim(ing->>'name') is not null
  and trim(ing->>'name') != ''
on conflict (name) do nothing;

-- Show what was seeded
select count(*) as total_ingredients from ingredients;

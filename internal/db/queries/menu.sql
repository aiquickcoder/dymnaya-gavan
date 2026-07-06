-- name: CreateMenuRecipe :one
insert into menu_recipes
    (restaurant_id, author_employee_id, name, description, strength, price, rating, tags, badge,
     kind, category, available, image_slug, components, sort_order)
values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
     coalesce((select max(sort_order) + 1 from menu_recipes
               where restaurant_id = $1 and removed_at is null), 0))
returning *;

-- name: ListMenuRecipes :many
-- Guest hookah menu: available hookah positions only, in admin-defined order.
select * from menu_recipes
where restaurant_id = $1 and removed_at is null and available and kind = 'hookah'
order by sort_order, created_at;

-- name: ListMenuRecipesAdmin :many
-- Admin menu: every non-removed position (incl. unavailable and kitchen).
select * from menu_recipes
where restaurant_id = $1 and removed_at is null
order by sort_order, created_at;

-- name: ListFoodMenu :many
-- Guest kitchen-bar menu: available kitchen positions only.
select * from menu_recipes
where restaurant_id = $1 and removed_at is null and available and kind = 'kitchen'
order by sort_order, created_at;

-- name: GetMenuRecipe :one
select * from menu_recipes
where id = $1 and removed_at is null;

-- name: UpdateMenuRecipe :one
-- Partial update: only fields passed as non-null are changed (coalesce pattern,
-- same convention as UpdateEmployee). Nullable fields cannot be cleared to null.
update menu_recipes
set name        = coalesce(sqlc.narg('name'), name),
    description = coalesce(sqlc.narg('description'), description),
    strength    = coalesce(sqlc.narg('strength'), strength),
    price       = coalesce(sqlc.narg('price'), price),
    rating      = coalesce(sqlc.narg('rating'), rating),
    tags        = coalesce(sqlc.narg('tags'), tags),
    badge       = coalesce(sqlc.narg('badge'), badge),
    kind        = coalesce(sqlc.narg('kind'), kind),
    category    = coalesce(sqlc.narg('category'), category),
    available   = coalesce(sqlc.narg('available'), available),
    sort_order  = coalesce(sqlc.narg('sort_order'), sort_order),
    image_slug  = coalesce(sqlc.narg('image_slug'), image_slug),
    components  = coalesce(sqlc.narg('components'), components),
    updated_at  = now()
where id = sqlc.arg('id') and removed_at is null
returning *;

-- name: ReorderMenuRecipes :exec
-- Bulk-set sort_order from the position of each id in the array (0-based).
update menu_recipes m
set sort_order = t.ord - 1, updated_at = now()
from unnest(@ids::uuid[]) with ordinality as t(id, ord)
where m.id = t.id and m.removed_at is null;

-- name: SoftRemoveMenuRecipe :exec
update menu_recipes
set removed_at = now(), updated_at = now()
where id = $1 and removed_at is null;

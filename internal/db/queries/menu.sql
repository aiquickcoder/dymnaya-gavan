-- name: CreateMenuRecipe :one
insert into menu_recipes
    (restaurant_id, author_employee_id, name, description, strength, price, rating, tags, badge)
values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
returning *;

-- name: ListMenuRecipes :many
select * from menu_recipes
where restaurant_id = $1 and removed_at is null
order by created_at desc;

-- name: GetMenuRecipe :one
select * from menu_recipes
where id = $1;

-- name: UpdateMenuRecipe :one
update menu_recipes
set name        = $2,
    description = $3,
    strength    = $4,
    price       = $5,
    rating      = $6,
    tags        = $7,
    badge       = $8,
    updated_at  = now()
where id = $1 and removed_at is null
returning *;

-- name: SoftRemoveMenuRecipe :exec
update menu_recipes
set removed_at = now(), updated_at = now()
where id = $1 and removed_at is null;

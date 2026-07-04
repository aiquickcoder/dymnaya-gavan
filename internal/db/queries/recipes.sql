-- name: CreateRecipe :one
insert into recipes (name, strength, is_secret)
values ($1, $2, $3)
returning *;

-- name: CreateComponent :one
insert into components (recipe_id, brand, flavour, percent)
values ($1, $2, $3, $4)
returning *;

-- name: GetRecipesByIDs :many
select * from recipes
where id = any($1::uuid[]);

-- name: ListComponentsByRecipeIDs :many
select * from components
where recipe_id = any($1::uuid[])
order by recipe_id, created_at;

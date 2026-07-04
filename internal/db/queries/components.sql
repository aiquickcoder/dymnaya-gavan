-- name: ListComponentsByRecipeID :many
select * from components
where recipe_id = $1
order by created_at;

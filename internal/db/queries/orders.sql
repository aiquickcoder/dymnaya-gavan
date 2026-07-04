-- name: GetTableAssignment :one
select * from table_assignments
where restaurant_id = $1 and table_id = $2;

-- name: CreateOrder :one
insert into orders (table_id, restaurant_id, user_id)
values ($1, $2, $3)
returning *;

-- name: CreateTableAssignment :one
insert into table_assignments (restaurant_id, table_id, order_id)
values ($1, $2, $3)
returning *;

-- name: GetOrder :one
select * from orders
where id = $1;

-- name: AttachRecipe :one
insert into order_recipes (order_id, recipe_id, employee_id)
values ($1, $2, $3)
returning *;

-- name: SoftRemoveOrderRecipe :one
update order_recipes
set removed_at = now()
where id = $1 and order_id = $2 and removed_at is null
returning *;

-- name: CloseOrder :one
update orders
set closed_at = now()
where id = $1 and closed_at is null
returning *;

-- name: DeleteTableAssignmentByOrder :exec
delete from table_assignments
where order_id = $1;

-- name: ListActiveOrderRecipes :many
select
    orr.id as order_recipe_id,
    orr.recipe_id,
    orr.employee_id,
    r.name as recipe_name,
    r.strength as recipe_strength,
    r.is_secret as recipe_is_secret,
    e.first_name,
    e.last_name,
    e.middle_name,
    e.short_name,
    orr.created_at
from order_recipes orr
join recipes r   on r.id = orr.recipe_id
join employees e on e.id = orr.employee_id
where orr.order_id = $1 and orr.removed_at is null
order by orr.created_at;

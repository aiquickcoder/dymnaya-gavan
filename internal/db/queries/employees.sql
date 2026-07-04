-- name: CreateRestaurant :one
insert into restaurants (name, code)
values ($1, $2)
returning *;

-- name: GetRestaurantByCode :one
select * from restaurants
where code = $1;

-- name: CreateEmployee :one
insert into employees (first_name, last_name, middle_name, short_name)
values ($1, $2, $3, $4)
returning *;

-- name: LinkEmployeeRestaurant :exec
insert into employee_restaurants (employee_id, restaurant_id, position)
values ($1, $2, $3)
on conflict (employee_id, restaurant_id)
do update set position = coalesce(excluded.position, employee_restaurants.position);

-- name: UpdateEmployee :one
update employees
set first_name  = coalesce(sqlc.narg('first_name'), first_name),
    last_name   = coalesce(sqlc.narg('last_name'), last_name),
    middle_name = coalesce(sqlc.narg('middle_name'), middle_name),
    short_name  = coalesce(sqlc.narg('short_name'), short_name),
    updated_at  = now()
where id = sqlc.arg('id')
returning *;

-- name: GetEmployeesByIDs :many
select * from employees
where id = any($1::uuid[]);

-- name: ListEmployeesByRestaurant :many
select e.*, er.position
from employees e
join employee_restaurants er on er.employee_id = e.id
where er.restaurant_id = $1
order by e.last_name, e.first_name;

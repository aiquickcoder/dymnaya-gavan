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
    phone       = coalesce(sqlc.narg('phone'), phone),
    photo_slug  = coalesce(sqlc.narg('photo_slug'), photo_slug),
    tip_url     = coalesce(sqlc.narg('tip_url'), tip_url),
    updated_at  = now()
where id = sqlc.arg('id')
returning *;

-- name: UpdateEmployeeRestaurant :exec
-- Partial update of the per-restaurant link (position/status). When
-- restaurant_id is null the change lands on every restaurant the master is
-- linked to (the admin usually operates within a single venue).
update employee_restaurants
set position = coalesce(sqlc.narg('position'), position),
    status   = coalesce(sqlc.narg('status'), status)
where employee_id = sqlc.arg('employee_id')
  and (sqlc.narg('restaurant_id')::uuid is null
       or restaurant_id = sqlc.narg('restaurant_id')::uuid);

-- name: GetEmployeeTipUrl :one
select tip_url from employees where id = $1;

-- name: GetEmployeeAnyRestaurant :one
select restaurant_id from employee_restaurants
where employee_id = $1
order by created_at
limit 1;

-- name: GetEmployeesByIDs :many
select * from employees
where id = any($1::uuid[]);

-- name: ListEmployeesByRestaurant :many
select e.*, er.position
from employees e
join employee_restaurants er on er.employee_id = e.id
where er.restaurant_id = $1
order by e.last_name, e.first_name;

-- name: ListEmployeesFullByRestaurant :many
-- Full admin roster for a venue: profile + per-venue position/status + global
-- rating aggregate + whether the master is on today's shift here.
select
    e.id,
    e.first_name,
    e.last_name,
    e.middle_name,
    e.short_name,
    e.phone,
    e.photo_slug,
    e.tip_url,
    coalesce(er.position, '')::text as position,
    er.status,
    coalesce(avg(rat.score), 0)::float8 as rating,
    count(distinct rat.id)::int as rating_count,
    coalesce(bool_or(s.id is not null), false) as on_shift
from employee_restaurants er
join employees e on e.id = er.employee_id
left join employee_ratings rat on rat.employee_id = e.id
left join shifts s
    on s.employee_id = e.id
   and s.restaurant_id = er.restaurant_id
   and s.shift_date = current_date
where er.restaurant_id = $1
group by e.id, er.position, er.status
order by e.last_name, e.first_name;

-- name: GetEmployeeFull :one
-- Single master in a venue context (used to echo back the row after a write).
select
    e.id,
    e.first_name,
    e.last_name,
    e.middle_name,
    e.short_name,
    e.phone,
    e.photo_slug,
    e.tip_url,
    coalesce(er.position, '')::text as position,
    er.status,
    coalesce(avg(rat.score), 0)::float8 as rating,
    count(distinct rat.id)::int as rating_count,
    coalesce(bool_or(s.id is not null), false) as on_shift
from employee_restaurants er
join employees e on e.id = er.employee_id
left join employee_ratings rat on rat.employee_id = e.id
left join shifts s
    on s.employee_id = e.id
   and s.restaurant_id = er.restaurant_id
   and s.shift_date = current_date
where er.employee_id = $1 and er.restaurant_id = $2
group by e.id, er.position, er.status;

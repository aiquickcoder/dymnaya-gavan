-- name: ListZones :many
select id, name from zones
where restaurant_id = $1
order by sort_order, name;

-- name: CreateZone :one
insert into zones (restaurant_id, name, sort_order)
values ($1, $2, $3)
returning *;

-- name: CountTables :one
select count(*) from venue_tables where restaurant_id = $1;

-- name: ListTablesFull :many
-- Config + live status: left-join the active (open) order via table_assignments
-- (linked by string label). order_id/opened_at are null ⇒ the table is free.
select
    t.id,
    t.restaurant_id,
    t.label,
    t.x,
    t.y,
    t.seats,
    t.shape,
    t.zone_id,
    o.id         as order_id,
    o.created_at as opened_at
from venue_tables t
left join table_assignments ta
    on ta.restaurant_id = t.restaurant_id and ta.table_id = t.label
left join orders o
    on o.id = ta.order_id and o.closed_at is null
where t.restaurant_id = $1
order by t.sort_order, t.label;

-- name: GetTableByID :one
select * from venue_tables where id = $1;

-- name: CreateTable :one
insert into venue_tables
    (restaurant_id, label, x, y, seats, shape, zone_id, sort_order)
values ($1, $2, $3, $4, $5, $6, $7, $8)
returning *;

-- name: UpdateTable :one
-- Partial update: only fields passed as non-null change (coalesce pattern).
update venue_tables
set label   = coalesce(sqlc.narg('label'), label),
    x       = coalesce(sqlc.narg('x'), x),
    y       = coalesce(sqlc.narg('y'), y),
    seats   = coalesce(sqlc.narg('seats'), seats),
    shape   = coalesce(sqlc.narg('shape'), shape),
    zone_id = coalesce(sqlc.narg('zone_id'), zone_id)
where id = sqlc.arg('id')
returning *;

-- name: MoveTable :exec
update venue_tables set x = $2, y = $3 where id = $1;

-- name: DeleteTable :exec
delete from venue_tables where id = $1;

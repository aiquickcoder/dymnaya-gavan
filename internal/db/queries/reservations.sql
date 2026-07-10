-- name: CreateReservation :one
insert into reservations
    (restaurant_id, guest_name, phone, res_date, start_time, end_time,
     table_id, guests, zone, status, note)
values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
returning *;

-- name: UpdateReservation :one
-- Partial update: only fields passed as non-null are changed (coalesce pattern,
-- same convention as UpdateMenuRecipe). Nullable fields cannot be cleared to null.
update reservations
set guest_name = coalesce(sqlc.narg('guest_name'), guest_name),
    phone      = coalesce(sqlc.narg('phone'), phone),
    res_date   = coalesce(sqlc.narg('res_date'), res_date),
    start_time = coalesce(sqlc.narg('start_time'), start_time),
    end_time   = coalesce(sqlc.narg('end_time'), end_time),
    table_id   = coalesce(sqlc.narg('table_id'), table_id),
    guests     = coalesce(sqlc.narg('guests'), guests),
    zone       = coalesce(sqlc.narg('zone'), zone),
    status     = coalesce(sqlc.narg('status'), status),
    note       = coalesce(sqlc.narg('note'), note)
where id = sqlc.arg('id')
returning *;

-- name: ListReservations :many
-- All reservations of a restaurant, optionally filtered to a single day.
-- Sorted by date then start time (matches the admin "Брони" list).
select * from reservations
where restaurant_id = $1
  and (sqlc.narg('res_date')::date is null or res_date = sqlc.narg('res_date')::date)
order by res_date, start_time;

-- name: SetReservationStatus :exec
update reservations
set status = $2
where id = $1;

-- name: DeleteReservation :exec
delete from reservations where id = $1;

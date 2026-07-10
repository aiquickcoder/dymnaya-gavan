-- name: RegisterDevice :one
-- Upsert a staff device's FCM token (idempotent by token; re-binds to the latest
-- employee/restaurant on re-login or device hand-off).
insert into devices (employee_id, restaurant_id, platform, fcm_token)
values ($1, $2, $3, $4)
on conflict (fcm_token) do update
set employee_id   = excluded.employee_id,
    restaurant_id = excluded.restaurant_id,
    platform      = excluded.platform,
    updated_at    = now()
returning *;

-- name: DeleteDevice :exec
-- Drop a device token (logout / FCM reports it unregistered).
delete from devices where fcm_token = $1;

-- name: ListOnShiftDeviceTokens :many
-- FCM tokens of staff who are on today's shift at this venue — the push audience.
select distinct d.fcm_token
from devices d
join shifts s
  on s.employee_id   = d.employee_id
 and s.restaurant_id = d.restaurant_id
 and s.shift_date    = current_date
where d.restaurant_id = $1;

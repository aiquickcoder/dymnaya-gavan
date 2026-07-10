-- name: CreateCall :one
-- Guest taps "Позвать" at their table → a new call lands in /admin/calls.
insert into calls (restaurant_id, table_id, type)
values ($1, $2, $3)
returning *;

-- name: ListActiveCalls :many
-- Active calls: new before ack, freshest first within each group.
select * from calls
where restaurant_id = $1 and status in ('new', 'ack')
order by case status when 'new' then 0 when 'ack' then 1 else 2 end,
         created_at desc;

-- name: ListArchiveCalls :many
-- Completed calls, most recently done first.
select * from calls
where restaurant_id = $1 and status = 'done'
order by coalesce(done_at, created_at) desc;

-- name: AckCall :exec
-- Acknowledge a call (new → ack). No-op if it is not currently new.
update calls
set status = 'ack', acked_at = now()
where id = $1 and status = 'new';

-- name: DoneCall :exec
-- Complete a call; backfill acked_at if it was never acknowledged.
update calls
set status = 'done',
    done_at = now(),
    acked_at = coalesce(acked_at, now())
where id = $1 and status <> 'done';

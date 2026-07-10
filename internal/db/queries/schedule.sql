-- name: AddSchedule :exec
-- Mark a master as working on a given calendar day at a venue. Idempotent.
insert into employee_schedule (restaurant_id, employee_id, work_date)
values ($1, $2, $3)
on conflict (restaurant_id, employee_id, work_date) do nothing;

-- name: DeleteSchedule :exec
delete from employee_schedule
where restaurant_id = $1 and employee_id = $2 and work_date = $3;

-- name: ListScheduleRange :many
-- Every scheduled (master, day) inside [from, to] for a venue. Only masters
-- that have at least one day in range appear; the handler folds the rows into
-- one ScheduleRow per master with a date -> true map.
select
    sch.employee_id,
    e.short_name,
    coalesce(er.position, '')::text as position,
    sch.work_date
from employee_schedule sch
join employees e on e.id = sch.employee_id
left join employee_restaurants er
    on er.employee_id = sch.employee_id
   and er.restaurant_id = sch.restaurant_id
where sch.restaurant_id = $1
  and sch.work_date between sqlc.arg('from_date') and sqlc.arg('to_date')
order by e.last_name, e.first_name, sch.work_date;

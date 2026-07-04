-- name: DeleteShiftsToday :exec
delete from shifts
where restaurant_id = $1 and shift_date = current_date;

-- name: AddShiftToday :exec
insert into shifts (restaurant_id, employee_id)
values ($1, $2)
on conflict (restaurant_id, employee_id, shift_date) do nothing;

-- name: ListShiftToday :many
select
    e.id,
    e.first_name,
    e.last_name,
    e.middle_name,
    e.short_name,
    empr.position,
    coalesce(avg(er.score), 0)::float8 as rating,
    count(er.id)::int as rating_count
from shifts s
join employees e              on e.id = s.employee_id
left join employee_restaurants empr on empr.employee_id = e.id and empr.restaurant_id = s.restaurant_id
left join employee_ratings er on er.employee_id = e.id
where s.restaurant_id = $1 and s.shift_date = current_date
group by e.id, empr.position
order by e.last_name, e.first_name;

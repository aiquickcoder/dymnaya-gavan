-- name: UpsertEmployeeRating :one
insert into employee_ratings (employee_id, user_id, score)
values ($1, $2, $3)
on conflict (employee_id, user_id)
do update set score = excluded.score, updated_at = now()
returning *;

-- name: GetEmployeeRatingAgg :one
select
    coalesce(avg(score), 0)::float8 as average,
    count(*)::int as count
from employee_ratings
where employee_id = $1;

-- name: ListEmployeeRatings :many
select score, updated_at, user_id
from employee_ratings
where employee_id = $1
order by updated_at desc;

-- name: UpsertOrderRecipeRating :one
insert into order_recipe_feedback (order_recipe_id, user_id, score)
values ($1, $2, $3)
on conflict (order_recipe_id, user_id)
do update set score = excluded.score, updated_at = now()
returning *;

-- name: UpsertOrderRecipeReview :one
insert into order_recipe_feedback (order_recipe_id, user_id, review)
values ($1, $2, $3)
on conflict (order_recipe_id, user_id)
do update set review = excluded.review, updated_at = now()
returning *;

-- name: ListEmployeeRecipeFeedback :many
select
    f.order_recipe_id,
    f.score,
    f.review,
    f.updated_at,
    orr.recipe_id,
    r.name as recipe_name,
    r.strength as recipe_strength
from order_recipe_feedback f
join order_recipes orr on orr.id = f.order_recipe_id
join recipes r         on r.id = orr.recipe_id
where orr.employee_id = $1
  and (f.score is not null or f.review is not null)
order by f.updated_at desc;

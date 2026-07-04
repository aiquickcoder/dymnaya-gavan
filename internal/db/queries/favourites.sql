-- name: AddFavourite :exec
insert into favourites (user_id, order_recipe_id)
values ($1, $2)
on conflict do nothing;

-- name: RemoveFavourite :exec
delete from favourites
where user_id = $1 and order_recipe_id = $2;

-- name: ListFavourites :many
select
    f.order_recipe_id,
    f.liked_at,
    orr.recipe_id,
    orr.employee_id,
    r.name        as recipe_name,
    r.strength    as recipe_strength,
    r.is_secret   as recipe_is_secret,
    e.first_name,
    e.last_name,
    e.middle_name,
    e.short_name,
    o.restaurant_id,
    rest.name     as restaurant_name,
    fb.score      as my_score,
    fb.review     as my_review
from favourites f
join order_recipes orr on orr.id = f.order_recipe_id
join recipes r        on r.id = orr.recipe_id
join employees e      on e.id = orr.employee_id
join orders o         on o.id = orr.order_id
join restaurants rest on rest.id = o.restaurant_id
left join order_recipe_feedback fb
       on fb.order_recipe_id = f.order_recipe_id and fb.user_id = f.user_id
where f.user_id = $1
order by f.liked_at desc;

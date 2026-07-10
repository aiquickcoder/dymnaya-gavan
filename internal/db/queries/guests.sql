-- Гости (клиенты) заведения = отдельные users, засветившиеся через orders.
--
-- ВАЖНО про LTV/выручку: цена НЕ фиксируется на заказе (у order_recipes нет
-- price). Поэтому ltv/ltv_month/total — ПРИБЛИЖЕНИЕ: каждый налитый микс
-- (order_recipe) оценивается ценой одноимённой позиции меню этого заведения
-- (recipes.name = menu_recipes.name), а если совпадения нет — фиксированным
-- оценочным чеком 600.0. Настоящая выручка появится в Волне аналитики, когда
-- на заказе появится зафиксированная цена.

-- name: ListGuestsByRestaurant :many
-- Все гости, побывавшие в заведении, с приближёнными агрегатами (см. заметку выше).
with venue_orders as (
    select o.id, o.user_id, o.restaurant_id, o.created_at
    from orders o
    where o.restaurant_id = $1 and o.user_id is not null
),
order_recipe_prices as (
    select
        vo.user_id,
        vo.created_at,
        r.name as recipe_name,
        coalesce(
            (select m.price from menu_recipes m
              where m.restaurant_id = vo.restaurant_id
                and m.name = r.name
                and m.removed_at is null
              limit 1),
            600.0
        )::float8 as est_price
    from venue_orders vo
    join order_recipes orr on orr.order_id = vo.id and orr.removed_at is null
    left join recipes r on r.id = orr.recipe_id
),
guest_visits as (
    select user_id, count(*)::int as visits, max(created_at) as last_visit
    from venue_orders
    group by user_id
),
guest_ltv as (
    select
        user_id,
        coalesce(sum(est_price), 0)::float8 as ltv,
        coalesce(sum(est_price) filter (where created_at >= now() - interval '30 days'), 0)::float8 as ltv_month
    from order_recipe_prices
    group by user_id
),
guest_scores as (
    select vo.user_id, avg(f.score)::float8 as avg_score
    from venue_orders vo
    join order_recipes orr on orr.order_id = vo.id
    join order_recipe_feedback f on f.order_recipe_id = orr.id and f.user_id = vo.user_id
    where f.score is not null
    group by vo.user_id
),
guest_fav as (
    select distinct on (user_id) user_id, recipe_name
    from (
        select user_id, recipe_name, count(*) as c
        from order_recipe_prices
        where recipe_name is not null
        group by user_id, recipe_name
    ) t
    order by user_id, c desc
)
select
    u.id,
    u.phone_number,
    u.created_at,
    gv.visits,
    gv.last_visit,
    coalesce(gl.ltv, 0)::float8       as ltv,
    coalesce(gl.ltv_month, 0)::float8 as ltv_month,
    gs.avg_score,
    gf.recipe_name as favourite_mix
from guest_visits gv
join users u on u.id = gv.user_id
left join guest_ltv gl on gl.user_id = u.id
left join guest_scores gs on gs.user_id = u.id
left join guest_fav gf on gf.user_id = u.id
order by gv.last_visit desc nulls last;

-- name: GetGuestSummary :one
-- Один гость (глобально, по всем заведениям): те же приближённые агрегаты.
-- Агрегаты вынесены в отдельные CTE и подключены обычным LEFT JOIN по user_id
-- (не LATERAL): так sqlc корректно типизирует avg_score/favourite_mix как
-- nullable — гость без оценок/заказов вернёт NULL.
with u_orders as (
    select o.id, o.restaurant_id, o.created_at
    from orders o
    where o.user_id = $1
),
order_recipe_prices as (
    select
        uo.created_at,
        r.name as recipe_name,
        coalesce(
            (select m.price from menu_recipes m
              where m.restaurant_id = uo.restaurant_id and m.name = r.name and m.removed_at is null
              limit 1),
            600.0
        )::float8 as est_price
    from u_orders uo
    join order_recipes orr on orr.order_id = uo.id and orr.removed_at is null
    left join recipes r on r.id = orr.recipe_id
),
agg_visits as (
    select $1::uuid as user_id, count(*)::int as visits, max(created_at) as last_visit
    from u_orders
),
agg_ltv as (
    select $1::uuid as user_id,
        coalesce(sum(est_price), 0)::float8 as ltv,
        coalesce(sum(est_price) filter (where created_at >= now() - interval '30 days'), 0)::float8 as ltv_month
    from order_recipe_prices
),
agg_score as (
    select $1::uuid as user_id, avg(f.score)::float8 as avg_score
    from u_orders uo
    join order_recipes orr on orr.order_id = uo.id
    join order_recipe_feedback f on f.order_recipe_id = orr.id and f.user_id = $1
    where f.score is not null
),
agg_fav as (
    select $1::uuid as user_id, recipe_name
    from order_recipe_prices
    where recipe_name is not null
    group by recipe_name
    order by count(*) desc
    limit 1
)
select
    u.id,
    u.phone_number,
    u.created_at,
    coalesce(av.visits, 0)::int as visits,
    av.last_visit,
    coalesce(al.ltv, 0)::float8       as ltv,
    coalesce(al.ltv_month, 0)::float8 as ltv_month,
    sc.avg_score,
    fav.recipe_name as favourite_mix
from users u
left join agg_visits av on av.user_id = u.id
left join agg_ltv    al on al.user_id = u.id
left join agg_score  sc on sc.user_id = u.id
left join agg_fav   fav on fav.user_id = u.id
where u.id = $1;

-- name: ListOrdersByUser :many
-- История визитов гостя: одна строка на заказ с налитыми миксами, мастером
-- (первый привязанный мастер), приближённым чеком (см. заметку про LTV) и
-- средней оценкой гостя по этому заказу. master/score вынесены в CTE и
-- подключены LEFT JOIN по order_id — так они корректно nullable в sqlc.
with order_masters as (
    select distinct on (orr.order_id) orr.order_id, e.short_name
    from order_recipes orr
    join orders o2 on o2.id = orr.order_id and o2.user_id = $1
    join employees e on e.id = orr.employee_id
    where orr.removed_at is null
    order by orr.order_id, orr.created_at
),
order_scores as (
    select orr.order_id, avg(f.score)::float8 as avg_score
    from order_recipes orr
    join orders o2 on o2.id = orr.order_id and o2.user_id = $1
    join order_recipe_feedback f on f.order_recipe_id = orr.id and f.user_id = o2.user_id
    where f.score is not null
    group by orr.order_id
)
select
    o.id as order_id,
    o.created_at,
    o.table_id,
    coalesce(
        array_agg(distinct r.name) filter (where r.name is not null),
        '{}'
    )::text[] as mixes,
    om.short_name as master,
    coalesce(sum(coalesce(
        (select m.price from menu_recipes m
          where m.restaurant_id = o.restaurant_id and m.name = r.name and m.removed_at is null
          limit 1),
        600.0)) filter (where orr.id is not null), 0)::float8 as total,
    os.avg_score as score
from orders o
left join order_recipes orr on orr.order_id = o.id and orr.removed_at is null
left join recipes r on r.id = orr.recipe_id
left join order_masters om on om.order_id = o.id
left join order_scores  os on os.order_id = o.id
where o.user_id = $1
group by o.id, om.short_name, os.avg_score
order by o.created_at desc;

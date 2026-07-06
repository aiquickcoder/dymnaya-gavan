-- +goose Up
-- +goose StatementBegin

-- Админ-поля позиции меню: тип (кальян/кухня), категория, доступность,
-- ручная сортировка, слаг картинки и покомпонентный состав (jsonb).
alter table menu_recipes
    add column kind        text    not null default 'hookah',
    add column category    text    not null default '',
    add column available   boolean not null default true,
    add column sort_order  integer not null default 0,
    add column image_slug  text,
    add column components   jsonb   not null default '[]';

-- Тип позиции ограничен двумя значениями.
alter table menu_recipes add constraint menu_recipes_kind_check
    check (kind in ('hookah', 'kitchen'));

-- Кухонные позиции без крепости: правило 1..10 действует только для кальяна.
alter table menu_recipes drop constraint if exists menu_recipes_strength_check;
alter table menu_recipes add constraint menu_recipes_strength_check
    check (kind = 'kitchen' or (strength between 1 and 10));

-- Детерминированный бэкфилл sort_order: порядок создания внутри каждого ресторана.
update menu_recipes m
set sort_order = t.rn - 1
from (
    select id,
           row_number() over (partition by restaurant_id order by created_at) as rn
    from menu_recipes
) t
where m.id = t.id;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
alter table menu_recipes drop constraint if exists menu_recipes_strength_check;
alter table menu_recipes add constraint menu_recipes_strength_check
    check (strength between 1 and 10);
alter table menu_recipes drop constraint if exists menu_recipes_kind_check;
alter table menu_recipes
    drop column if exists components,
    drop column if exists image_slug,
    drop column if exists sort_order,
    drop column if exists available,
    drop column if exists category,
    drop column if exists kind;
-- +goose StatementEnd

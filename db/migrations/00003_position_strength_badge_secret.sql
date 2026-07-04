-- +goose Up
-- +goose StatementBegin

-- Позиция/грейд мастера в конкретном заведении (просто текст).
alter table employee_restaurants add column position text;

-- Крепость рецепта (1..10) и флаг «секретный вкус».
-- strength nullable: старые рецепты без крепости остаются валидными; на создании требуется в API.
alter table recipes add column strength integer;
alter table recipes add constraint recipes_strength_range
    check (strength is null or (strength between 1 and 10));
alter table recipes add column is_secret boolean not null default false;

-- Бейдж/ярлык позиции меню (ХИТ / LIMITED / ЗВЕЗДА / НОВИНКИ ...).
alter table menu_recipes add column badge text;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
alter table menu_recipes drop column if exists badge;
alter table recipes drop column if exists is_secret;
alter table recipes drop constraint if exists recipes_strength_range;
alter table recipes drop column if exists strength;
alter table employee_restaurants drop column if exists position;
-- +goose StatementEnd

-- +goose Up
-- +goose StatementBegin

-- Зоны зала («Основной зал», «VIP» …). Стол ссылается на зону (nullable).
create table zones (
    id            uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id),
    name          text not null,
    sort_order    integer not null default 0,
    created_at    timestamptz not null default now()
);
create index zones_restaurant_idx on zones (restaurant_id);

-- Столы зала (интерактивная карта). x/y — проценты (0..100) канвы плана зала.
-- Живой статус (свободен/занят) тут НЕ хранится — выводится из открытого заказа
-- (orders/table_assignments, связь по строковому label). shape ∈ round|square|rect.
create table venue_tables (
    id            uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id),
    label         text not null,
    x             double precision not null default 50,
    y             double precision not null default 50,
    seats         integer not null default 4,
    shape         text not null default 'round',
    zone_id       uuid references zones(id) on delete set null,
    sort_order    integer not null default 0,
    created_at    timestamptz not null default now(),
    constraint venue_tables_shape_check check (shape in ('round', 'square', 'rect'))
);
create index venue_tables_restaurant_idx on venue_tables (restaurant_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists venue_tables;
drop table if exists zones;
-- +goose StatementEnd

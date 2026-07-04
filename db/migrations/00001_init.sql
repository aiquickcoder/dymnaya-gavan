-- +goose Up
-- +goose StatementBegin

create table restaurants (
    id         uuid primary key default gen_random_uuid(),
    name       text not null,
    code       text not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table employees (
    id          uuid primary key default gen_random_uuid(),
    first_name  text not null,
    last_name   text not null,
    middle_name text not null default '',
    short_name  text not null default '',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create table employee_restaurants (
    employee_id   uuid not null references employees(id),
    restaurant_id uuid not null references restaurants(id),
    rating        integer,
    created_at    timestamptz not null default now(),
    primary key (employee_id, restaurant_id)
);

create table recipes (
    id         uuid primary key default gen_random_uuid(),
    name       text,
    created_at timestamptz not null default now()
);

create table components (
    id         uuid primary key default gen_random_uuid(),
    recipe_id  uuid not null references recipes(id),
    brand      text not null,
    flavour    text not null,
    percent    integer not null,
    created_at timestamptz not null default now()
);

create table users (
    id           uuid primary key default gen_random_uuid(),
    phone_number text not null unique,
    gender       text,
    created_at   timestamptz not null default now()
);

create table orders (
    id            uuid primary key default gen_random_uuid(),
    table_id      text not null,
    restaurant_id uuid not null references restaurants(id),
    user_id       uuid references users(id),
    created_at    timestamptz not null default now(),
    closed_at     timestamptz
);

-- Указатель «текущий активный заказ на столе». Один стол = одна запись.
create table table_assignments (
    id            uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id),
    table_id      text not null,
    order_id      uuid not null references orders(id),
    updated_at    timestamptz not null default now(),
    unique (restaurant_id, table_id)
);

-- Что и кто приготовил в рамках заказа. Физически не удаляется (removed_at = soft).
create table order_recipes (
    id          uuid primary key default gen_random_uuid(),
    order_id    uuid not null references orders(id),
    recipe_id   uuid not null references recipes(id),
    employee_id uuid not null references employees(id),
    created_at  timestamptz not null default now(),
    removed_at  timestamptz
);

create table favourites (
    user_id         uuid not null references users(id),
    order_recipe_id uuid not null references order_recipes(id),
    liked_at        timestamptz not null default now(),
    primary key (user_id, order_recipe_id)
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists favourites;
drop table if exists order_recipes;
drop table if exists table_assignments;
drop table if exists orders;
drop table if exists users;
drop table if exists components;
drop table if exists recipes;
drop table if exists employee_restaurants;
drop table if exists employees;
drop table if exists restaurants;
-- +goose StatementEnd

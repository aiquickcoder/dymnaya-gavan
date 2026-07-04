-- +goose Up
-- +goose StatementBegin

-- Оценка мастера (сотрудника) гостем, 1..5. Одна на пару (мастер, гость).
create table employee_ratings (
    id          uuid primary key default gen_random_uuid(),
    employee_id uuid not null references employees(id),
    user_id     uuid not null references users(id),
    score       integer not null check (score between 1 and 5),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (employee_id, user_id)
);

-- Оценка (1..5) и/или текстовый отзыв гостя на конкретный OrderRecipe.
create table order_recipe_feedback (
    id              uuid primary key default gen_random_uuid(),
    order_recipe_id uuid not null references order_recipes(id),
    user_id         uuid not null references users(id),
    score           integer check (score between 1 and 5),
    review          text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (order_recipe_id, user_id)
);

-- Мастера на смене в ресторане на конкретную дату.
create table shifts (
    id            uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id),
    employee_id   uuid not null references employees(id),
    shift_date    date not null default current_date,
    created_at    timestamptz not null default now(),
    unique (restaurant_id, employee_id, shift_date)
);

-- Меню рецептов заведения (отдельная от Recipes сущность).
create table menu_recipes (
    id                 uuid primary key default gen_random_uuid(),
    restaurant_id      uuid not null references restaurants(id),
    author_employee_id uuid not null references employees(id),
    name               text not null,
    description        text not null default '',
    strength           integer not null check (strength between 1 and 10),
    price              double precision not null,
    rating             double precision,
    tags               text[] not null,
    removed_at         timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists menu_recipes;
drop table if exists shifts;
drop table if exists order_recipe_feedback;
drop table if exists employee_ratings;
-- +goose StatementEnd

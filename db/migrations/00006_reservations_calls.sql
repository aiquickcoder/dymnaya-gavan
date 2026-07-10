-- +goose Up
-- +goose StatementBegin

-- Брони столов («Брони»): гость/админ бронирует стол на дату и интервал времени.
-- table_id — строковый label стола (напр. "7"); отдельного домена столов пока нет.
create table reservations (
    id            uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id),
    guest_name    text not null,
    phone         text not null default '',
    res_date      date not null,
    start_time    text not null,
    end_time      text not null,
    table_id      text,
    guests        integer not null default 2,
    zone          text,
    status        text not null default 'new',
    note          text,
    created_at    timestamptz not null default now(),
    constraint reservations_status_check
        check (status in ('new', 'confirmed', 'seated', 'cancelled'))
);

create index reservations_restaurant_date_idx
    on reservations (restaurant_id, res_date);

-- Вызовы («Обращения»): гость со стола зовёт мастера/угли/официанта/счёт.
-- Жизненный цикл: new → ack → done (acked_at/done_at проставляются на переходах).
create table calls (
    id            uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id),
    table_id      text not null,
    type          text not null,
    status        text not null default 'new',
    created_at    timestamptz not null default now(),
    acked_at      timestamptz,
    done_at       timestamptz,
    constraint calls_type_check
        check (type in ('master', 'coals', 'waiter', 'bill')),
    constraint calls_status_check
        check (status in ('new', 'ack', 'done'))
);

create index calls_restaurant_status_idx
    on calls (restaurant_id, status);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists calls;
drop table if exists reservations;
-- +goose StatementEnd

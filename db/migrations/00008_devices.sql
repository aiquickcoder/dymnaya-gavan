-- +goose Up
-- +goose StatementBegin

-- Push-токены устройств персонала (staff mobile app, iOS/Android). На вызов гостя
-- («Позвать») бэк шлёт FCM-пуш на устройства сотрудников, которые сегодня на смене
-- в этом заведении. Токен уникален; повторная регистрация перепривязывает его к
-- актуальному сотруднику (смена телефона/выход-вход).
create table devices (
    id            uuid primary key default gen_random_uuid(),
    employee_id   uuid not null references employees(id) on delete cascade,
    restaurant_id uuid not null references restaurants(id) on delete cascade,
    platform      text not null default 'android',
    fcm_token     text not null unique,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint devices_platform_check check (platform in ('android', 'ios'))
);
create index devices_restaurant_idx on devices (restaurant_id);
create index devices_employee_idx on devices (employee_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists devices;
-- +goose StatementEnd

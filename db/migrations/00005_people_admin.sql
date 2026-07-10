-- +goose Up
-- +goose StatementBegin

-- Профиль мастера: телефон, слаг фото и персональная ссылка на чаевые (Нетмонет).
alter table employees add column phone      text;
alter table employees add column photo_slug text;
alter table employees add column tip_url    text;

-- Статус сотрудника в конкретном заведении: 'active' | 'inactive'.
-- Неактивного нельзя ставить на смену (правило проверяется в UI/агрегатах).
alter table employee_restaurants add column status text not null default 'active';

-- График смен: наличие строки (restaurant_id, employee_id, work_date) = мастер
-- работает в этот день. Отдельно от таблицы shifts (та — «сегодня по факту»).
create table employee_schedule (
    id            uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id),
    employee_id   uuid not null references employees(id),
    work_date     date not null,
    created_at    timestamptz not null default now(),
    unique (restaurant_id, employee_id, work_date)
);

create index employee_schedule_restaurant_date_idx
    on employee_schedule (restaurant_id, work_date);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists employee_schedule;
alter table employee_restaurants drop column if exists status;
alter table employees drop column if exists tip_url;
alter table employees drop column if exists photo_slug;
alter table employees drop column if exists phone;
-- +goose StatementEnd

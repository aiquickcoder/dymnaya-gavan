-- +goose Up
-- +goose StatementBegin

-- Заполненные онбординг-брифы заведений (форма настройки HookahCRM под клиента).
-- Весь ответ хранится в payload (jsonb); ключевые поля вынесены отдельными
-- колонками для списка в админке.
create table onboarding_briefs (
    id         uuid primary key default gen_random_uuid(),
    venue      text not null default '',
    city       text not null default '',
    contact    text not null default '',
    phone      text not null default '',
    payload    jsonb not null default '{}'::jsonb,
    status     text not null default 'new',
    created_at timestamptz not null default now()
);
create index onboarding_briefs_created_idx on onboarding_briefs (created_at desc);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists onboarding_briefs;
-- +goose StatementEnd

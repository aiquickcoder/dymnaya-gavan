-- +goose Up
-- +goose StatementBegin

-- Web Push подписки (браузеры персонала: CRM как PWA / вкладка).
-- endpoint уникален; p256dh/auth — ключи подписки (base64url) для шифрования RFC8291.
create table webpush_subscriptions (
    id            uuid primary key default gen_random_uuid(),
    restaurant_id uuid,
    endpoint      text not null unique,
    p256dh        text not null,
    auth          text not null,
    created_at    timestamptz not null default now()
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists webpush_subscriptions;
-- +goose StatementEnd

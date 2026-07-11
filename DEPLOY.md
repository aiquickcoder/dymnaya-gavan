# Деплой бэкенда HookahCRM

Бэкенд — Go (модульный монолит) + Postgres. Онбординг-брифы и всё остальное
хранятся в Postgres (том `mixmaster_pg` переживает перезапуски).

## Локально / на сервере (Docker, одна команда)
```bash
docker compose up -d --build
# API на :8080, Postgres на :5432 (данные в volume mixmaster_pg)
# миграции применяются автоматически при старте api (docker-entrypoint.sh → goose up)
curl -s localhost:8080/health          # 200 ok
```
Проверка онбординга:
```bash
curl -s -X POST localhost:8080/onboarding -H 'Content-Type: application/json' \
  -d '{"venue":"Test","payload":{"Столов":"12"}}'
curl -s localhost:8080/onboarding      # список брифов
```

## Публичный доступ — нужен HTTPS
Бриф хостится на GitHub Pages (HTTPS) и **не сможет** слать на HTTP-бэкенд
(браузер блокирует mixed-content). Значит бэкенд нужен по **https://**. Варианты:

1. **Свой сервер + Caddy** (авто Let's Encrypt, проще всего):
   ```
   your.domain {
     reverse_proxy localhost:8080
   }
   ```
   `docker compose up -d` + Caddy перед ним → `https://your.domain`.

2. **Свой сервер + nginx + certbot** — вручную сертификат, `proxy_pass` на :8080.

3. **Cloud с авто-HTTPS** (Fly.io / Render / Railway): `Dockerfile` уже готов,
   managed Postgres, HTTPS из коробки. Нужен аккаунт провайдера.

4. **Cloudflare Tunnel** (быстро, без открытых портов): `cloudflared tunnel --url http://localhost:8080`
   → сразу отдаёт `https://…trycloudflare.com`. Для постоянного — named tunnel + домен.

## После публикации
1. Взять публичный `https://<адрес>`.
2. В `onboarding/index.html` выставить `var API_BASE = "https://<адрес>";` → передеплоить бриф.
3. CORS уже открыт (`AllowedOrigins: *`), брифы полетят в Postgres → раздел «Онбординг» в админке (реальный режим).

## Переменные окружения (api)
- `DATABASE_URL` — строка подключения Postgres (обязательно).
- `PORT` — порт (по умолчанию 8080).
- `FCM_CREDENTIALS_FILE`, `FCM_PROJECT_ID` — для staff-app пушей (опционально).

---

## Прод: сервер 155.212.156.162 + api.hookahmania.ru (ранбук)

**0. DNS (в панели регистратора hookahmania.ru):** A-запись
`api.hookahmania.ru → 155.212.156.162`. Дождаться, пока `dig api.hookahmania.ru`
вернёт этот IP (иначе Caddy не выпустит сертификат).

**1. На сервере (Ubuntu 24.04), под root:**
```bash
# Docker (если ещё нет)
curl -fsSL https://get.docker.com | sh

# Код
apt-get update && apt-get install -y git
git clone https://github.com/aiquickcoder/dymnaya-gavan.git /opt/hookahcrm
cd /opt/hookahcrm

# Пароль БД (замените на свой) и запуск прод-стека
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" > .env
docker compose -f docker-compose.prod.yml up -d --build
```
Caddy сам получит HTTPS-сертификат для `api.hookahmania.ru`.

**2. Проверка:**
```bash
curl -s https://api.hookahmania.ru/health           # {"data":...} 200
curl -s https://api.hookahmania.ru/onboarding        # [] пусто
```

**3. Фаервол:** открыть 80 и 443 (Caddy), 22 (SSH). Порт 8080 наружу НЕ нужен.

**4. Последний штрих (сделаю я):** в `onboarding/index.html`
`var API_BASE = "https://api.hookahmania.ru";` → передеплой брифа. После этого
заявки летят в Postgres → раздел «Онбординг».

Обновление версии: `git pull && docker compose -f docker-compose.prod.yml up -d --build`.

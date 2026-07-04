# mixMaster web

React + Vite + TypeScript SPA for the mixMaster API. One app, two sections:

- **Гость** — открыть стол (по `restaurantId` + `tableId`, или deep-link `/guest?r=<id>&t=<table>`),
  смотреть заказ с составом и автором, регистрация по телефону, избранное.
- **Сотрудник** — вход по коду ресторана → выбор себя → консоль: открыть стол,
  создать рецепт (сумма процентов = 100), повесить рецепт на стол, обнулить стол.

## Run

Needs Node 18+. Backend must be running on `:8080` (see project root README).

```bash
npm install
npm run dev      # http://localhost:5173
```

API base URL defaults to `http://localhost:8080`; override with `VITE_API_URL`.

```bash
VITE_API_URL=http://localhost:8080 npm run dev
```

## Structure

```
src/
  api.ts          typed client, unwraps the { data, error } envelope
  types.ts        DTOs mirrored from the Go API
  store.ts        localStorage session (guest / staff) — no real auth (R4.1 MVP)
  components/      small UI kit
  pages/
    Home.tsx
    guest/        CheckIn, Order, Register, Favourites
    staff/        Login, Console
```

## Build

```bash
npm run build    # tsc + vite build → dist/
```

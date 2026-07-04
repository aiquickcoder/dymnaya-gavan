# mixMaster

Backend for the mixMaster restaurant ordering / recipes app.
Modular monolith in Go — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, rules and endpoints.

## Stack

- **Go** + **chi** — HTTP router
- **sqlc** — type-safe SQL → Go (no ORM magic)
- **goose** — SQL migrations
- **PostgreSQL** — database
- **swaggo/swag** + **http-swagger** — auto-generated Swagger from handler annotations

## Layout

```
cmd/api/            entrypoint
internal/
  config/           env config
  httpx/            { data, error } response envelope
  server/           router + route mounting
  health/           liveness
  users/            guests + favourites  (implemented)
  orders/           order / table lifecycle (implemented)
  recipes/          recipes + components (implemented)
  employees/        employees + restaurants (implemented)
  db/               sqlc-generated code + queries/
db/migrations/      goose migrations
api/                generated swagger (docs.go, swagger.json/yaml)
```

All domains are wired end-to-end against PostgreSQL. The full flow — create
restaurant → register employee → create recipe → open table → attach recipe →
register guest → favourite — works through the API alone.

## Quick start

```bash
make tools          # install swag, sqlc, goose (one-time)
make db-up          # start postgres in docker
make migrate-up     # apply migrations
make run            # start the server on :8080
```

Swagger UI: http://localhost:8080/swagger/index.html

## Codegen

Regenerate after changing SQL or handler annotations:

```bash
make sqlc           # internal/db from db/migrations + internal/db/queries
make swag           # api/ from handler annotations
make generate       # both
```

## Test

```bash
go test ./...
```

The server smoke test (`internal/server`) verifies routing and that Swagger is served,
without needing a database.

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every push to `main` and PR:

1. `gofmt` — formatting check
2. `go vet`
3. `sqlc diff` — generated db code matches the SQL
4. swag regenerate + `git diff` — `api/` is up to date with handler annotations
5. `go build` + `go test`

Run the same checks locally before pushing:

```bash
make ci
```


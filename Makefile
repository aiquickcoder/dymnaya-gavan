.PHONY: tools db-up db-down migrate-up migrate-down sqlc swag generate run build tidy ci

DATABASE_URL ?= postgres://mixmaster:mixmaster@localhost:5432/mixmaster?sslmode=disable

tools: ## install codegen / migration toolchain
	go install github.com/swaggo/swag/cmd/swag@latest
	go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	go install github.com/pressly/goose/v3/cmd/goose@latest

db-up: ## start local postgres
	docker compose up -d

db-down: ## stop local postgres
	docker compose down

migrate-up: ## apply migrations
	goose -dir db/migrations postgres "$(DATABASE_URL)" up

migrate-down: ## roll back one migration
	goose -dir db/migrations postgres "$(DATABASE_URL)" down

sqlc: ## generate type-safe db code
	sqlc generate

swag: ## generate swagger docs into ./api
	swag init -g cmd/api/main.go -o api --parseInternal

generate: sqlc swag ## run all codegen

run: ## run the api server
	go run ./cmd/api

build: ## build the api binary
	go build -o bin/api ./cmd/api

tidy: ## tidy modules
	go mod tidy

ci: ## run the same checks as the CI pipeline
	@test -z "$$(gofmt -l internal cmd)" || (echo "gofmt: run 'gofmt -w internal cmd'"; gofmt -l internal cmd; exit 1)
	go vet ./...
	sqlc diff
	go build ./...
	go test ./...

.PHONY: help dev dev-api dev-web down clean umami-setup server-logs web-logs \
        seed seed-reset build test lint generate \
        deploy deploy-logs

# Project Directories
SERVER_DIR := apps/server
WEB_DIR    := apps/web

# Service Info
API_URL         := http://localhost:8080
WEB_URL         := http://localhost:3000
UMAMI_URL       := http://localhost:3001 (admin/umami)
SUPERTOKENS_URL := http://localhost:3567
MINIO_URL       := http://localhost:9001 (narval/narval_secret)

# Reusable Logic Blocks
define wait_and_seed
	@echo "Waiting for postgres..."
	@until docker compose exec -T postgres pg_isready -U narval -q; do sleep 1; done
	@echo "Seeding database..."
	@cd scripts/seed && go run .
endef

define print_status
	@echo ""
	@echo "> Services Status:"
	@echo "  API:         $(API_URL)"
	@echo "  Web:         $(WEB_URL)"
	@echo "  Umami:       $(UMAMI_URL)"
	@echo "  SuperTokens: $(SUPERTOKENS_URL)"
	@echo "  MinIO:       $(MINIO_URL)"
	@echo ""
endef

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# --- Development environments ---

dev: ## Start all services in compose
	@echo "Starting all services in Docker..."
	DOCKER_BUILDKIT=1 docker compose --profile full up -d --build
	$(call wait_and_seed)
	$(call print_status)
	@echo "Logs: make server-logs | make web-logs"

dev-api: ## Start all services, Go server locally with hot reload
	@echo "Starting infrastructure services..."
	DOCKER_BUILDKIT=1 docker compose up -d --build postgres redis minio supertokens umami
	$(call wait_and_seed)
	$(call print_status)
	@echo "Starting local API with air..."
	@cd $(SERVER_DIR) && air

dev-web: ## Start all services, Web locally with hot reload
	@echo "Starting backend services..."
	DOCKER_BUILDKIT=1 docker compose up -d --build postgres redis minio supertokens umami server
	$(call wait_and_seed)
	$(call print_status)
	@echo "Starting local web with npm..."
	@cd $(WEB_DIR) && npm run dev

# --- Service management ---

down: ## Stop all services
	docker compose --profile full down
	@echo "> All services stopped (data preserved)"

clean: ## Stop all services and delete all data
	docker compose --profile full down -v
	@docker volume rm narval_postgres_data narval_redis_data narval_minio_data 2>/dev/null || true
	@echo "> All services stopped and volumes removed"

umami-setup: ## Set up Umami analytics (run after starting services)
	@./scripts/umami-setup/setup.sh

server-logs: ## View server logs
	docker compose logs -f server

web-logs: ## View web logs
	docker compose logs -f web

seed: ## Seed the database with fake data
	cd scripts/seed && go run .

seed-reset: ## Re-seed from scratch
	cd scripts/seed && go run . --reset

# --- Build, Test, Lint & Codegen ---

build: ## Build all Docker images (production)
	docker build -t narval-server ./$(SERVER_DIR)
	docker build -t narval-web ./$(WEB_DIR)

test: ## Run all unit tests
	cd $(SERVER_DIR) && go test -v -short ./...
	cd $(WEB_DIR) && npm run test

lint: ## Lint and format all code
	cd $(SERVER_DIR) && golangci-lint run --fix ./... && gofmt -w .
	cd $(WEB_DIR) && npm run lint -- --fix && npm run fmt

lint-check: ## Check linting without modifying files (for pre-commit hook)
	cd $(SERVER_DIR) && golangci-lint run ./... && test -z "$$(gofmt -l .)"
	cd $(WEB_DIR) && npm run lint && npx prettier --check .

ci: ## Run CI jobs locally with act (test + integration)
	act -j test -j integration --container-architecture linux/amd64

# --- Production deployment ---

deploy: ## Deploy to production — push to main, CI handles the rest
	@echo "Push to main triggers CI: test → build images → SSH deploy"
	@echo "Track progress: https://github.com/$(shell git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git//')/actions"

deploy-logs: ## Tail production logs via SSH (requires DROPLET_IP env var)
	@test -n "$(DROPLET_IP)" || (echo "Set DROPLET_IP env var" && exit 1)
	ssh root@$(DROPLET_IP) "cd /opt/narval && docker compose -f docker-compose.prod.yml logs -f server web"

generate: ## Regenerate code from OpenAPI spec
	@echo "Bundling OpenAPI spec..."
	cd $(SERVER_DIR)/api && npx --yes @redocly/cli bundle openapi.yaml -o openapi.bundled.yaml
	@echo "Generating server code..."
	cd $(SERVER_DIR) && go generate ./...
	@echo "Generating web client..."
	cd $(WEB_DIR) && npm run generate

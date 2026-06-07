SHELL := /bin/sh

PNPM := pnpm
SCCACHE := $(shell command -v sccache 2>/dev/null)
RUSTC_WRAPPER_ENV := $(if $(SCCACHE),RUSTC_WRAPPER=$(SCCACHE),)

.PHONY: help
help:
	@printf '%s\n' \
		'Svard targets:' \
		'  make install          Install frontend dependencies' \
		'  make dev-web          Start browser-first UI dev server' \
		'  make dev-tauri        Start Tauri dev app' \
		'  make typecheck        Run TypeScript typecheck' \
		'  make lint             Run lint' \
		'  make format           Run formatter' \
		'  make build            Build browser UI' \
		'  make site-install     Install static site dependencies' \
		'  make site-dev         Start static site dev server' \
		'  make site-build       Build static site' \
		'  make site-screenshots Capture missing native app screenshots for static site' \
		'  make site-screenshots-force Re-capture all native app screenshots' \
		'  make site-preview     Preview built static site' \
		'  make tauri-check      Run cargo check for src-tauri' \
		'  make tauri-test       Run cargo test for src-tauri' \
		'  make tauri-build      Build Tauri app' \
		'  make test-unit        Run unit tests' \
		'  make test-integration Run integration tests' \
		'  make test-e2e         Run browser E2E tests' \
		'  make check            Run docs, TS, unit, and Tauri checks' \
		'  make verify           Run build, check, integration, and E2E gates' \
		'  make verify-ui-change Run browser-first UI change quality gate' \
		'  make ci-manual-smoke  Trigger GitHub Actions desktop smoke workflow' \
		'  make ci-manual-build  Trigger GitHub Actions desktop build workflow' \
		'  make sccache-stats    Show sccache stats when installed' \
		'  make clean            Remove generated artifacts except Rust target cache' \
		'  make clean-all        Remove generated artifacts and Rust target cache'

.PHONY: install
install:
	$(PNPM) install

.PHONY: dev-web
dev-web:
	$(PNPM) run dev:web

.PHONY: dev-tauri
dev-tauri:
	$(PNPM) run tauri:dev

.PHONY: typecheck lint format build site-install site-dev site-build site-screenshots site-screenshots-force site-preview test-unit test-integration test-e2e tauri-check tauri-test tauri-build check verify verify-ui-change ci-manual-smoke ci-manual-build sccache-stats clean clean-all

typecheck:
	$(PNPM) run typecheck

lint:
	$(PNPM) run lint

format:
	$(PNPM) run format

build:
	$(PNPM) run build

site-install:
	$(PNPM) --dir site install

site-dev:
	$(PNPM) --dir site run dev

site-build:
	$(PNPM) --dir site run build

site-screenshots:
	node scripts/site-screenshots.mjs

site-screenshots-force:
	node scripts/site-screenshots.mjs --force

site-preview:
	$(PNPM) --dir site run preview

tauri-check:
	$(RUSTC_WRAPPER_ENV) $(PNPM) run tauri:check

tauri-test:
	$(RUSTC_WRAPPER_ENV) $(PNPM) run tauri:test

tauri-build:
	$(PNPM) run tauri:build

test-unit:
	$(PNPM) run test:unit

test-integration:
	$(PNPM) run test:integration

test-e2e:
	$(PNPM) run test:e2e

check:
	$(PNPM) run check

verify:
	$(PNPM) run verify

verify-ui-change:
	$(PNPM) run verify:ui-change -- --scenario $(or $(SCENARIO),smoke) --id $(or $(ID),local-ui-change)

ci-manual-smoke:
	gh workflow run desktop-release.yml -f mode=smoke

ci-manual-build:
	gh workflow run desktop-release.yml -f mode=build

sccache-stats:
	@if command -v sccache >/dev/null 2>&1; then \
		sccache --show-stats; \
	else \
		printf '%s\n' 'sccache is not installed. Install with: brew install sccache'; \
	fi

clean:
	rm -rf dist playwright-report test-results .artifacts/ui-review .artifacts/tmp

clean-all: clean
	rm -rf src-tauri/target

# Changelog

## [Unreleased]

### Added

- `assertGatewayToolSuccess()` helper for detecting gateway HTTP 200 + error body masking (FE-1)
- `GatewayToolError` type with integration into `classifyApiError()`
- Unit and integration tests for gateway tool error handling and case lifecycle actions
- Dev dependencies: `@testing-library/react`, `jsdom` for component/hook tests

### Fixed

- Plugin execute calls in `storage.service`, `plugins.service`, `graph-explorer.service`, and `workflow.service` now reject masked upstream failures instead of treating them as success
- Case Importer pause/resume/cancel actions were already wired via `useCaseLifecycleActions`; tests added to lock behavior

### Manual verification

See [docs/MANUAL-TEST-CASE-IMPORTER-ACTIONS.md](./docs/MANUAL-TEST-CASE-IMPORTER-ACTIONS.md)

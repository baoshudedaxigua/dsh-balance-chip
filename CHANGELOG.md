# Changelog

All notable changes to this project are documented in this file.

## [0.1.0] - 2026-11-09

### Added

- First public release.
- Shows the DeepSeek **topped-up balance** immediately after the sidebar nickname in the bottom-left account launcher.
- Hover tooltip with the granted-balance breakdown (when positive).
- Auto-hide while the sidebar is collapsed or no DeepSeek account is signed in.
- Refresh every 60 seconds and on window focus / visibility change.
- CNY / USD amounts formatted like the official account page; sub-cent balances render as `<¥0.01`.
- `scripts/install-desktop.ps1` for one-command desktop installation and removal.
- `scripts/check-bundle.mjs` offline bundle contract self-test (`npm run check`).
- Read the DSH release identity from `window.__DSH_BOOT__.release` instead of hard-coding it.

### Verified

- DeepSeek Harness `0.2.1-rc.5`, Windows desktop and web (`dsh web`) profiles.

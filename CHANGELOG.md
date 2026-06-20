# Changelog

## Unreleased

- Added a Diagram Inspector sidebar tab for reviewing diagram render status, source references, cache state, metrics, and SVG actions.
- Added Diagram Inspector list navigation so selecting a diagram scrolls the viewer to its rendered location.
- Added an Includes section to the Contents sidebar for inspecting AsciiDoc include dependencies and status.
- Added an opt-in external PlantUML fallback for diagrams that the built-in renderer cannot render.
- Added support for root-relative local image paths such as `/images/...` in static-site style documents.

## 1.0.3

- Added conditional AsciiDoc include support for `ifdef`, `ifndef`, `ifeval`, and attribute-substituted include targets.
- Added MkDocs-style Markdown admonition rendering for `!!! note` and related alert blocks.
- Improved document open performance by showing diagram placeholders before local diagram rendering finishes.
- Added local PlantUML SVG caching so repeated diagrams can reopen faster without using Kroki.
- Documented PlantUML local renderer assets as pinned `@plantuml/core` TeaVM runtime files with Kroki kept as an explicit fallback.
- Fixed Change Review Mode table markers and diagnostics, including whole-file-added table row highlighting.
- Fixed large table Diff Preview so single-row additions stay focused instead of marking following rows changed.
- Improved large AsciiDoc render preparation performance by reducing sanitizer overhead.

## 1.0.2

- Added opt-in Change Review Mode so working tree changes are visible in the viewer without opening Diff Preview.
- Enhanced rendered Diff Preview visuals for list item changes and consistent Git change highlighting.
- Enhanced rendered Diff Preview table review with row targets and cell-level highlighting.
- Reduced viewer flicker by keeping Git change markers stable during unrelated file updates.

## 1.0.1

- Initial usable public release of Svard, a local-first desktop viewer for AsciiDoc and Markdown documents.
- Added document reading workflows with Files, bookmarks, search, Source Control, and preview-based diff views.
- Added local diagram rendering with explicit Kroki fallback support.
- Added macOS Apple Silicon and Windows x86_64 release builds.

## 1.0.0

- Release attempt superseded by 1.0.1.

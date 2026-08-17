# Changelog

## 1.0.6

- Added workspace-native Codex AI Chat with Markdown answers, interactive Visualize output, provider setup, and configurable model, reasoning, personality, access, network, and web-search settings.
- Added document selections, files, images, diagrams, rendered changes, and working-tree summaries as explicit AI Chat context, with workspace isolation and context-use diagnostics.
- Added conversation history and management, retry and reuse actions, answer and code copying, reconnect support, and Queue, Steer, and Stop and Send controls for running turns.
- Added resizable AI Chat placements on the right, bottom, Diff Preview, and All Diffs, plus a separate window that preserves drafts, running turns, and approvals.
- Improved Markdown and AsciiDoc math rendering around non-ASCII prose, numeric table cells, and stem matrices while preserving ambiguous identifiers and currency text.
- Added safe compact Markdown details blocks while keeping arbitrary raw HTML disabled.

## 1.0.5

- Added LLM-ready text, original source, and diff references with file, line, and section context.
- Added LLM-ready image copying for images, diagrams, and captured Viewer and Diff areas with optional source references.
- Added a runtime review session for changed documents in Documents and Source Control views.
- Added an All diffs stream for reviewing Markdown and AsciiDoc Source Control changes together.
- Extended All diffs to Branch Diff and Repo Graph commit reviews.
- Added review watch refresh for changed document streams and active Diff Preview stale states.
- Improved Change Ruler alignment with active Diff Preview and All diffs change targets.
- Improved Diff Preview Change Ruler positioning by projecting rendered markers onto the right pane.
- Unified rendered Diff Preview and All diffs indicators with passive left-margin range markers while retaining overview rulers.
- Fixed Markdown table rendering for compact GFM separators and wide technical tables.
- Improved MkDocs, Zensical, and Antora document order views with Git change counts, and fixed root-based Zensical navigation.

## 1.0.4

- Added a Diagram Inspector sidebar tab for reviewing diagram render status, source references, cache state, metrics, and SVG actions.
- Added Diagram Inspector list navigation so selecting a diagram scrolls the viewer to its rendered location.
- Added an Includes section to the Contents sidebar for inspecting AsciiDoc include dependencies and status.
- Added a Links section to the Contents sidebar for loaded document links and backlinks.
- Added collapsed AsciiDoc Document Attributes metadata for root document header attributes.
- Added an opt-in external PlantUML fallback for diagrams that the built-in renderer cannot render.
- Added support for root-relative local image paths such as `/images/...` in static-site style documents.
- Added Documents only ordering for MkDocs, Zensical, and Antora static navigation sources.
- Added Antora playbook context selection so Docs order and AsciiDoc rendering use the same detected context.
- Fixed reload rendering so unchanged documents keep their viewer content while local assets are rehydrated.
- Improved Documents only review by sorting changed documents by status and marking open documents.
- Improved source block toolbars so long code lines are not obscured until hover or focus.

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

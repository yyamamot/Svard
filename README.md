# Svard

Svard (Specification Viewer and Rendered Diff) is a local-first desktop viewer for technical Markdown and AsciiDoc documents. It is built with Tauri and keeps normal document rendering on the local machine.

## Website

Product overview, features, and download notes are available at:

https://yyamamot.github.io/Svard/

## Features

- Local rendering for Markdown, AsciiDoc, Mermaid, PlantUML, and Graphviz-oriented workflows
- Kroki support only as an explicit fallback path for unsupported or compatibility-focused diagrams
- Browser-like reading with tabs, history, recently closed documents, quick open, split view, and find-in-page
- Preview-based diff views for Markdown / AsciiDoc documents, including rendered content, tables, diagrams, and source views
- Privacy-focused review and runtime artifacts that avoid storing source text, diagram source, private absolute paths, or repository roots by default

PlantUML local rendering is based on the official `@plantuml/core` TeaVM browser build. Kroki remains an explicit fallback for diagrams that need compatibility beyond the bundled local renderer.

## Development

Requirements:

- Node.js 24 LTS
- pnpm 10
- Rust stable

Common checks:

```bash
pnpm install
pnpm run typecheck
pnpm run lint
pnpm run test:unit
pnpm run tauri:check
```

Run the web harness:

```bash
pnpm run dev:web
```

Run the Tauri app:

```bash
pnpm run dev:tauri
```

## Acknowledgements

Svard takes inspiration from [Arto](https://github.com/arto-app/Arto) in its emphasis on local-first document reading and quiet desktop viewer workflows.

The bundled PlantUML browser renderer is based on the official [`@plantuml/core`](https://www.npmjs.com/package/@plantuml/core) TeaVM build. Kroki is supported only as an explicit fallback path.

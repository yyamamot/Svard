# Rendered Diff Fixture

This Markdown file is intended for screenshots of rendered comparison workflows.

## Release note draft

Svard helps readers inspect documentation changes as rendered output.

- Read local AsciiDoc and Markdown documents
- Compare Git changes against a merge target
- Review diagrams with local rendering first
- Avoid rewriting source for viewer convenience

## Example change area

The rendered diff view should make reader-visible changes easy to inspect.

| Section  | Before                | After                      |
| -------- | --------------------- | -------------------------- |
| Search   | Current file only     | Current file and all files |
| Diff     | Source line diff      | Rendered output comparison |
| Diagrams | Remote fallback first | Local rendering first      |

## Public-safe note

This fixture intentionally avoids private paths, tokens, repository URLs, and endpoint URLs.

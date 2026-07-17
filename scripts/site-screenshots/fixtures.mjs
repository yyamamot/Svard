import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, run } from "./common.mjs";

export async function prepareFixtureCopies({
  capture,
  fixtureRoot,
  fixturePath,
}) {
  const copies = [];
  if (capture.fixtureSource) {
    copies.push({ source: capture.fixtureSource, target: capture.fixture });
  }
  for (const copy of capture.extraFixtureSources ?? []) {
    copies.push(copy);
  }

  for (const copy of copies) {
    const sourcePath = path.resolve(fixtureRoot, copy.source);
    const targetPath = path.resolve(fixtureRoot, copy.target);
    await ensureDir(path.dirname(targetPath));
    await fs.copyFile(sourcePath, targetPath);
  }

  await fs.access(fixturePath);
}

async function prepareGitStatusWorkspace({ artifactRoot, id }) {
  const workspaceRoot = path.join(
    artifactRoot,
    "fixtures",
    "source-control-workspace",
  );
  const fixturePath = path.join(workspaceRoot, "source-control.md");
  const filesFixturePath = path.join(workspaceRoot, "files.md");
  const addedPath = path.join(workspaceRoot, "release-notes.md");
  const architecturePath = path.join(workspaceRoot, "architecture.md");
  const reviewNotesPath = path.join(workspaceRoot, "review-notes.md");
  const gitCommit = (message) =>
    run(
      "git",
      [
        "-c",
        "user.name=Svard Screenshot",
        "-c",
        "user.email=svard-screenshot@example.invalid",
        "commit",
        "-m",
        message,
      ],
      { cwd: workspaceRoot },
    );

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(workspaceRoot);
  await fs.writeFile(
    fixturePath,
    `# Source Control Fixture

This file is intended for public screenshots of the Source Control view.

## Git changes

Svard presents Git changes alongside rendered document context.

## Merge target review

Merge-target comparisons are treated as reader-facing review inputs.
`,
  );
  await fs.writeFile(
    architecturePath,
    `# Review Architecture

Svard keeps document review close to the rendered reading surface.

## Review inputs

Readers can inspect local changes, branch differences, and document history without rewriting source files.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "README.md"),
    `# Screenshot Workspace

This public-safe workspace is generated for static site screenshots.
`,
  );
  await fs.writeFile(
    filesFixturePath,
    `# Files Fixture

This document is opened for public screenshots of the Files tree.

## Local folder

Svard opens local folders and lets readers choose markup documents from the tree.

## Git status

The tree can show changed documents without opening Source Control first.
`,
  );
  await run("git", ["init"], { cwd: workspaceRoot });
  await run("git", ["branch", "-M", "main"], { cwd: workspaceRoot });
  await run("git", ["add", "."], { cwd: workspaceRoot });
  await gitCommit("Initial screenshot fixture");
  await fs.appendFile(
    fixturePath,
    `
## Review baseline

The baseline branch keeps the current public documentation stable.
`,
  );
  await fs.appendFile(
    architecturePath,
    `
## Baseline review

The review entry points are read-only surfaces for document changes.
`,
  );
  await run("git", ["add", "."], { cwd: workspaceRoot });
  await gitCommit("Add review baseline");
  await run("git", ["checkout", "-b", "review-docs"], { cwd: workspaceRoot });
  await fs.appendFile(
    fixturePath,
    `
## Branch review

Branch Diff compares the review branch against the selected base branch.
`,
  );
  await fs.appendFile(
    architecturePath,
    `
## History review

Repo Graph shows the flow of commits before opening a document-level diff.
`,
  );
  await fs.writeFile(
    reviewNotesPath,
    `# Review Notes

This document appears only on the review branch.
`,
  );
  await run("git", ["add", "."], { cwd: workspaceRoot });
  await gitCommit("Update review documents");
  await fs.appendFile(
    fixturePath,
    `
## Working tree review

The Source Control view shows changed markup files before opening a rendered diff.
`,
  );
  await fs.writeFile(
    addedPath,
    `# Release Notes

This added document appears in Source Control as a public-safe working tree change.
`,
  );

  return id === "files" ? filesFixturePath : fixturePath;
}

async function prepareRenderedDiffWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(
    artifactRoot,
    "fixtures",
    "rendered-diff-workspace",
  );
  const fixturePath = path.join(workspaceRoot, "rendered-diff.md");
  const baseContent = `# Rendered Diff Fixture

This Markdown file is intended for screenshots of rendered comparison workflows.

## Release note draft

Svard helps readers inspect documentation changes as rendered output.

- Read local AsciiDoc and Markdown documents
- Compare Git changes against a merge target
- Review diagrams with local rendering first
- Avoid rewriting source for viewer convenience

## Example change area

The rendered diff view should make reader-visible changes easy to inspect.

| Section | Before | After |
| --- | --- | --- |
| Search | Current file only | Current file and all files |
| Diff | Source line diff | Rendered output comparison |
| Diagrams | Remote fallback first | Local rendering first |

## Public-safe note

This fixture intentionally avoids private paths, tokens, repository URLs, and endpoint URLs.
`;
  const changedContent = `# Rendered Diff Fixture

This Markdown file is intended for screenshots of rendered comparison workflows.

## Release note draft

Svard helps reviewers inspect documentation changes directly in the rendered preview.

- Read local AsciiDoc and Markdown documents
- Compare Git changes against a merge target
- Review changed list items and tables in the preview
- Keep Git change markers stable while nearby files update
- Avoid rewriting source for viewer convenience

## Example change area

The rendered diff view should make reader-visible changes easy to inspect and navigate.

| Section | Before | After |
| --- | --- | --- |
| Search | Current document only | Current file and all files |
| Diff | Source line diff | Rendered output comparison |
| Diagrams | Remote fallback first | Local rendering and fallback |

## Public-safe note

This fixture intentionally avoids private paths, tokens, repository URLs, and endpoint URLs.
`;

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(workspaceRoot);
  await fs.writeFile(fixturePath, baseContent);
  await run("git", ["init"], { cwd: workspaceRoot });
  await run("git", ["add", "."], { cwd: workspaceRoot });
  await run(
    "git",
    [
      "-c",
      "user.name=Svard Screenshot",
      "-c",
      "user.email=svard-screenshot@example.invalid",
      "commit",
      "-m",
      "Initial rendered diff screenshot fixture",
    ],
    { cwd: workspaceRoot },
  );
  await fs.writeFile(fixturePath, changedContent);
  return fixturePath;
}

async function prepareTableCopyWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(artifactRoot, "fixtures", "table-copy");
  const fixturePath = path.join(workspaceRoot, "table-copy.adoc");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(workspaceRoot);
  await fs.writeFile(
    fixturePath,
    `= Table Copy Sample

This public sample is used for table copy screenshots.

[cols="1,1,1", options="header"]
|===
|Area
|Owner
|Status

|Reader
|Docs
|Ready

|Search
|Review
|Planned

|Diagrams
|Preview
|Ready
|===
`,
  );

  return fixturePath;
}

async function prepareLinkDocumentActionsWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(
    artifactRoot,
    "fixtures",
    "link-document-actions",
  );
  const fixturePath = path.join(workspaceRoot, "guide.md");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(workspaceRoot);
  await fs.writeFile(
    fixturePath,
    `# Link Actions Guide

This public guide shows how Svard lets readers inspect links before opening them.

## Review links

Use the [Related runbook](./related-runbook.md#review-checklist) before continuing a review.

The link points to another local document in this public sample workspace.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "related-runbook.md"),
    `# Related Runbook

## Review checklist

This public runbook preview explains the destination without exposing private paths.

- Confirm the target document.
- Continue reading in the local workspace.
`,
  );

  return fixturePath;
}

async function prepareWorkspaceSearchWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(artifactRoot, "fixtures", "workspace-search");
  const fixturePath = path.join(workspaceRoot, "overview.md");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(path.join(workspaceRoot, "notes"));
  await fs.writeFile(
    fixturePath,
    `# Workspace Search Overview

This public guide describes how readers find documents across a local folder.

## Search scenario

Workspace search helps locate review notes, release plans, and diagrams without knowing the exact file.

## Reader note

The result list should keep file names and short snippets visible.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "release-plan.md"),
    `# Release Plan

The review workflow includes reading local documents, checking rendered changes, and returning to related notes.

## Workspace search

Search can find review terms across files while keeping the reading workspace open.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "notes", "diagram-review.md"),
    `# Diagram Review Notes

Review diagrams as rendered document content before relying on fallback behavior.

## Search example

The review term appears here so workspace search can show a second file.
`,
  );

  return fixturePath;
}

async function prepareMkDocsDocumentsOrderWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(
    artifactRoot,
    "fixtures",
    "documents-order-mkdocs",
  );
  const fixturePath = path.join(workspaceRoot, "overview.md");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(workspaceRoot);
  await fs.writeFile(
    path.join(workspaceRoot, "mkdocs.yml"),
    `site_name: Documentation Sample
docs_dir: .
nav:
  - Start: overview.md
  - Review workflow:
      - Read local docs: read-local-docs.md
      - Compare rendered changes: compare-rendered-changes.md
      - Check diagrams: check-diagrams.md
  - Operations:
      - Release checklist: release-checklist.md
      - Privacy boundary: privacy-boundary.md
  - Reference: reference.md
`,
  );
  const documents = {
    "overview.md": `# Documentation Sample

This public-safe sample is used for the Documents order screenshot.

## Start

Svard can keep local files readable while following the same navigation order readers expect from a static documentation site.
`,
    "read-local-docs.md": `# Read local docs

Open local Markdown and AsciiDoc files without building a static site.
`,
    "compare-rendered-changes.md": `# Compare rendered changes

Review document changes as rendered output before relying on source diffs.
`,
    "check-diagrams.md": `# Check diagrams

Inspect diagrams from the same local reading workspace.
`,
    "release-checklist.md": `# Release checklist

Use a short checklist to confirm reader-visible documentation changes.
`,
    "privacy-boundary.md": `# Privacy boundary

Keep source text, private paths, and endpoints out of public artifacts.
`,
    "reference.md": `# Reference

Use this page as a compact local reference entry.
`,
  };

  for (const [fileName, content] of Object.entries(documents)) {
    await fs.writeFile(path.join(workspaceRoot, fileName), content);
  }

  return fixturePath;
}

async function prepareReadingDocumentsWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(
    artifactRoot,
    "fixtures",
    "reading-documents",
  );
  const fixturePath = path.join(workspaceRoot, "guide.adoc");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(path.join(workspaceRoot, "partials"));
  await ensureDir(path.join(workspaceRoot, "assets"));
  await fs.writeFile(
    fixturePath,
    `= Reading Documents Guide
:imagesdir: assets

This public sample shows the reading features used by the static site.

== Overview

Svard displays local technical documents as readable pages.

== Included note

include::partials/review-note.adoc[]

== Local image

image::local-workflow.svg[Local workflow,width=520]

== Navigation section

The contents panel helps readers move across long documents.

== Display section

Theme and zoom settings change how the document is read.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "partials", "review-note.adoc"),
    `The included note is rendered as part of the document while staying inside the sample workspace.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "assets", "local-workflow.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="220" viewBox="0 0 640 220" role="img" aria-label="Local reading workflow">
  <rect width="640" height="220" rx="18" fill="#f8fafc"/>
  <rect x="38" y="72" width="132" height="76" rx="12" fill="#e0f2fe" stroke="#0369a1" stroke-width="2"/>
  <rect x="254" y="72" width="132" height="76" rx="12" fill="#dcfce7" stroke="#15803d" stroke-width="2"/>
  <rect x="470" y="72" width="132" height="76" rx="12" fill="#fef3c7" stroke="#b45309" stroke-width="2"/>
  <path d="M184 110h54" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
  <path d="m232 102 12 8-12 8" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M400 110h54" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
  <path d="m448 102 12 8-12 8" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="104" y="104" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">Local files</text>
  <text x="320" y="104" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">Render</text>
  <text x="536" y="104" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">Read</text>
  <text x="104" y="128" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">AsciiDoc</text>
  <text x="320" y="128" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">in app</text>
  <text x="536" y="128" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">preview</text>
</svg>
`,
  );

  return fixturePath;
}

async function prepareFirstDocumentWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(artifactRoot, "fixtures", "first-document");
  const fixturePath = path.join(workspaceRoot, "guide.adoc");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(path.join(workspaceRoot, "notes"));
  await fs.writeFile(
    fixturePath,
    `= Getting Started Guide

This public sample is used for the first document screenshots.

== Start reading

Choose a local folder, then open an AsciiDoc or Markdown document from the tree.

== Next document

The file tree keeps nearby documents visible while the reader stays focused on the current page.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "README.md"),
    `# Sample Workspace

Open this folder to read local AsciiDoc and Markdown documents in Svard.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "notes", "overview.md"),
    `# Overview

This nearby note is part of the same public sample workspace.
`,
  );

  return fixturePath;
}

async function prepareDiagramDocsWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(artifactRoot, "fixtures", "diagrams");
  const fixturePath = path.join(workspaceRoot, "overview.adoc");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(workspaceRoot);
  await fs.writeFile(
    fixturePath,
    `= Diagram Review Guide

This public sample shows rendered diagrams inside a local document.

== System flow

[mermaid]
....
flowchart LR
  local[Local files] --> render[Local render]
  render --> read[Readable preview]
....

== Review sequence

[plantuml]
....
@startuml
actor Reader
participant Svard
Reader -> Svard: Open document
Svard --> Reader: Rendered diagram
@enduml
....

== Dependency map

[graphviz]
....
digraph G {
  rankdir=LR;
  docs -> diagrams;
  diagrams -> preview;
  preview -> review;
}
....
`,
  );

  return fixturePath;
}

export async function prepareScreenshotFixture({
  artifactRoot,
  capture,
  fixturePath,
}) {
  if (
    capture.id === "hero-plantuml" ||
    capture.id === "reader-main" ||
    capture.id === "search"
  ) {
    await ensureDir(path.dirname(fixturePath));
    const content =
      capture.id === "hero-plantuml"
        ? `= Diagram preview\n\n[plantuml]\n----\nAlice -> Bob: Review locally\nBob --> Alice: Rendered result\n----\n`
        : capture.id === "reader-main"
          ? `# Product guide\n\n## Read technical documents\n\nSvard keeps document reading local and focused.\n\n## Review rendered changes\n\nCompare the result readers see.\n`
          : `# Search guide\n\n## Review notes\n\nSearch within the current document without leaving the reading flow.\n\n## Review results\n\nUse a short public-safe term for screenshots.\n`;
    await fs.writeFile(fixturePath, content);
    return fixturePath;
  }
  if (
    capture.id === "source-control" ||
    capture.id === "source-control-changes" ||
    capture.id === "source-control-ref-context-menu" ||
    capture.id === "source-control-open-diff" ||
    capture.id === "source-control-branch-diff" ||
    capture.id === "source-control-branch-diff-preview" ||
    capture.id === "source-control-repo-graph" ||
    capture.id === "source-control-file-history" ||
    capture.id === "files"
  ) {
    return prepareGitStatusWorkspace({ artifactRoot, id: capture.id });
  }
  if (
    capture.id === "rendered-diff" ||
    capture.id === "table-list-diff-review" ||
    capture.id === "table-list-diff-table" ||
    capture.id === "change-review-mode-markers"
  ) {
    return prepareRenderedDiffWorkspace({ artifactRoot });
  }
  if (capture.id === "table-copy-context-menu") {
    return prepareTableCopyWorkspace({ artifactRoot });
  }
  if (
    capture.id === "link-hover-preview" ||
    capture.id === "link-context-menu"
  ) {
    return prepareLinkDocumentActionsWorkspace({ artifactRoot });
  }
  if (
    capture.id === "workspace-search" ||
    capture.id === "workspace-search-result"
  ) {
    return prepareWorkspaceSearchWorkspace({ artifactRoot });
  }
  if (capture.id === "documents-order") {
    return prepareMkDocsDocumentsOrderWorkspace({ artifactRoot });
  }
  if (
    capture.id === "table-of-contents" ||
    capture.id === "table-of-contents-jump" ||
    capture.id === "includes-local-assets" ||
    capture.id === "includes-local-assets-boundary" ||
    capture.id === "themes-zoom-preferences" ||
    capture.id === "themes-zoom-reader" ||
    capture.id === "zen-mode-entry" ||
    capture.id === "zen-mode"
  ) {
    return prepareReadingDocumentsWorkspace({ artifactRoot });
  }
  if (
    capture.id === "first-document-open-folder" ||
    capture.id === "first-document-reader"
  ) {
    return prepareFirstDocumentWorkspace({ artifactRoot });
  }
  if (
    capture.id === "diagram-inspector" ||
    capture.id === "diagram-inline-preview-entry" ||
    capture.id === "diagram-preview" ||
    capture.id === "diagram-save-action" ||
    capture.id === "diagram-loading-cache"
  ) {
    return prepareDiagramDocsWorkspace({ artifactRoot });
  }
  return fixturePath;
}

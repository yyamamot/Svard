import { describe, expect, it } from "vitest";
import type { DocumentDiffPreview } from "../../src/core/types";
import {
  buildRenderedDiffPresentation,
  type RenderedBlockDiff,
} from "../../src/ui/lib/gitRenderedDiff";
import { selectionSnapshotText } from "../../src/ui/lib/documentSelection";
import {
  extractRenderedDiffCurrentChange,
  renderedDiffChangeIndexAtTarget,
} from "../../src/ui/lib/renderedDiffCurrentChange";

const preview: DocumentDiffPreview = {
  status: "modified",
  relativePath: "docs/example.md",
  leftLabel: "HEAD",
  rightLabel: "Working Tree",
  hunks: [],
  leftText: "",
  rightText: "",
};

function renderedBlock(
  id: string,
  kind: RenderedBlockDiff["kind"],
  blockKind: RenderedBlockDiff["blockKind"],
  left?: { html: string; text: string },
  right?: { html: string; text: string },
): RenderedBlockDiff {
  return {
    id,
    kind,
    blockKind,
    left: left
      ? { id: `${id}:left`, kind: blockKind, tagName: "div", ...left }
      : undefined,
    right: right
      ? { id: `${id}:right`, kind: blockKind, tagName: "div", ...right }
      : undefined,
  };
}

function rootFor(
  index: number,
  leftContent: string | null,
  rightContent: string | null,
  nested = false,
) {
  const root = document.createElement("div");
  root.innerHTML = `
    <section class="git-rendered-pane" data-capture-side="left" data-capture-revision-label="HEAD">
      <div class="git-rendered-scroll">
        ${
          leftContent === null
            ? ""
            : nested
              ? `<article class="git-rendered-block"><div class="git-rendered-block-content">${leftContent}</div></article>`
              : `<article class="git-rendered-block" data-change-index="${index}"><div class="git-rendered-block-content">${leftContent}</div></article>`
        }
      </div>
    </section>
    <section class="git-rendered-pane" data-capture-side="right" data-capture-revision-label="Working Tree">
      <div class="git-rendered-scroll">
        ${
          rightContent === null
            ? ""
            : nested
              ? `<article class="git-rendered-block"><div class="git-rendered-block-content">${rightContent}</div></article>`
              : `<article class="git-rendered-block" data-change-index="${index}"><div class="git-rendered-block-content">${rightContent}</div></article>`
        }
      </div>
    </section>
  `;
  return root;
}

describe("extractRenderedDiffCurrentChange", () => {
  it("resolves the nearest exact semantic target and rejects context", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <article class="git-rendered-block change-target" data-change-index="1">
        <p class="git-rendered-list-item-change" data-change-index="2">
          <span id="nested-target">Changed item</span>
        </p>
      </article>
      <p id="context-target">Context</p>
    `;

    expect(
      renderedDiffChangeIndexAtTarget(
        root.querySelector<HTMLElement>("#nested-target")!,
        root,
      ),
    ).toBe(2);
    expect(
      renderedDiffChangeIndexAtTarget(
        root.querySelector<HTMLElement>("#context-target")!,
        root,
      ),
    ).toBeNull();
  });

  it("captures a changed paragraph as one paired context", async () => {
    const presentation = buildRenderedDiffPresentation([
      renderedBlock(
        "paragraph",
        "changed",
        "paragraph",
        { html: "<p>Before text</p>", text: "Before text" },
        { html: "<p>After text</p>", text: "After text" },
      ),
    ]);
    const target = presentation.navigationTargets[0]!;
    const root = rootFor(
      target.index,
      "<p>Before text</p>",
      "<p>After text</p>",
    );

    const snapshot = await extractRenderedDiffCurrentChange({
      presentation,
      preview,
      root,
      target,
    });

    expect(snapshot.changeKind).toBe("changed");
    expect(selectionSnapshotText(snapshot.before!)).toContain("Before text");
    expect(selectionSnapshotText(snapshot.after!)).toContain("After text");
    expect(snapshot.diagnostics).not.toContainEqual(
      expect.objectContaining({ severity: "blocking" }),
    );
  });

  it("captures every block in a one-sided rendered group", async () => {
    const presentation = buildRenderedDiffPresentation([
      renderedBlock("added-1", "added", "paragraph", undefined, {
        html: "<p>First added</p>",
        text: "First added",
      }),
      renderedBlock("added-2", "added", "paragraph", undefined, {
        html: "<p>Second added</p>",
        text: "Second added",
      }),
    ]);
    const target = presentation.navigationTargets[0]!;
    const root = rootFor(
      target.index,
      null,
      "<p>First added</p><p>Second added</p>",
    );

    const snapshot = await extractRenderedDiffCurrentChange({
      presentation,
      preview,
      root,
      target,
    });

    expect(snapshot.changeKind).toBe("added");
    expect(snapshot.before).toBeUndefined();
    expect(selectionSnapshotText(snapshot.after!)).toContain("First added");
    expect(selectionSnapshotText(snapshot.after!)).toContain("Second added");
  });

  it("captures only the active list item", async () => {
    const block = renderedBlock(
      "list",
      "changed",
      "list",
      { html: "<ul><li>Old item</li><li>Context</li></ul>", text: "Old item" },
      { html: "<ul><li>New item</li><li>Context</li></ul>", text: "New item" },
    );
    block.childChanges = [
      {
        kind: "changed",
        side: "both",
        confidence: "high",
        leftIndex: 0,
        rightIndex: 0,
      },
    ];
    const presentation = buildRenderedDiffPresentation([block]);
    const target = presentation.navigationTargets[0]!;
    const root = rootFor(
      target.index,
      `<ul><li data-change-index="${target.index}">Old item</li><li>Context</li></ul>`,
      `<ul><li data-change-index="${target.index}">New item</li><li>Context</li></ul>`,
      true,
    );

    const snapshot = await extractRenderedDiffCurrentChange({
      presentation,
      preview,
      root,
      target,
    });

    expect(snapshot.before?.plainText).toContain("Old item");
    expect(snapshot.after?.plainText).toContain("New item");
    expect(snapshot.before?.plainText).not.toContain("Context");
    expect(snapshot.after?.plainText).not.toContain("Context");
  });

  it("captures only the active structured child and table row", async () => {
    const definition = renderedBlock(
      "definition",
      "changed",
      "definition-list",
      { html: "<dl><dt>Term</dt><dd>Old definition</dd></dl>", text: "Old" },
      { html: "<dl><dt>Term</dt><dd>New definition</dd></dl>", text: "New" },
    );
    definition.structuredChanges = [
      {
        kind: "changed",
        side: "both",
        confidence: "high",
        role: "definition-item",
        leftIndex: 0,
        rightIndex: 0,
      },
    ];
    const definitionPresentation = buildRenderedDiffPresentation([definition]);
    const definitionTarget = definitionPresentation.navigationTargets[0]!;
    const definitionRoot = rootFor(
      definitionTarget.index,
      `<dl><dt>Term</dt><dd data-change-index="${definitionTarget.index}">Old definition</dd><dt>Other</dt><dd>Context definition</dd></dl>`,
      `<dl><dt>Term</dt><dd data-change-index="${definitionTarget.index}">New definition</dd><dt>Other</dt><dd>Context definition</dd></dl>`,
      true,
    );
    const definitionSnapshot = await extractRenderedDiffCurrentChange({
      presentation: definitionPresentation,
      preview,
      root: definitionRoot,
      target: definitionTarget,
    });
    expect(definitionSnapshot.before?.plainText).toContain("Old definition");
    expect(definitionSnapshot.before?.plainText).not.toContain(
      "Context definition",
    );

    const table = renderedBlock(
      "table",
      "changed",
      "table",
      { html: "<table><tr><td>Old row</td></tr></table>", text: "Old row" },
      { html: "<table><tr><td>New row</td></tr></table>", text: "New row" },
    );
    table.tableChanges = [
      {
        kind: "changed",
        side: "both",
        confidence: "high",
        leftRowIndex: 1,
        rightRowIndex: 1,
        leftCellIndex: 0,
        rightCellIndex: 0,
      },
    ];
    const tablePresentation = buildRenderedDiffPresentation([table]);
    const tableTarget = tablePresentation.navigationTargets[0]!;
    const tableRoot = rootFor(
      tableTarget.index,
      `<table><tr><th>Header</th></tr><tr data-change-index="${tableTarget.index}"><td>Old row</td></tr><tr><td>Context row</td></tr></table>`,
      `<table><tr><th>Header</th></tr><tr data-change-index="${tableTarget.index}"><td>New row</td></tr><tr><td>Context row</td></tr></table>`,
      true,
    );
    const tableSnapshot = await extractRenderedDiffCurrentChange({
      presentation: tablePresentation,
      preview,
      root: tableRoot,
      target: tableTarget,
    });
    expect(selectionSnapshotText(tableSnapshot.before!)).toContain("Old row");
    expect(selectionSnapshotText(tableSnapshot.before!)).not.toContain(
      "Header",
    );
    expect(selectionSnapshotText(tableSnapshot.before!)).not.toContain(
      "Context row",
    );
  });

  it("uses a stable opaque identity and blocks an inexact target", async () => {
    const presentation = buildRenderedDiffPresentation([
      renderedBlock(
        "paragraph",
        "changed",
        "paragraph",
        { html: "<p>Before</p>", text: "Before" },
        { html: "<p>After</p>", text: "After" },
      ),
    ]);
    const target = presentation.navigationTargets[0]!;
    const root = rootFor(target.index, "<p>Before</p>", null);
    const first = await extractRenderedDiffCurrentChange({
      presentation,
      preview,
      root,
      target,
    });
    const second = await extractRenderedDiffCurrentChange({
      presentation,
      preview,
      root,
      target,
    });

    expect(first.snapshotId).toBe(second.snapshotId);
    expect(first.snapshotId).not.toContain(preview.relativePath);
    expect(first.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "blocking" }),
    );
  });
});

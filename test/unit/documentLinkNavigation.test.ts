import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  activateDocumentLinkIntent,
  captureDocumentLinkActivation,
  classifyDocumentLinkHref,
  deactivateUnresolvedDocumentLinksInPlace,
  relativeResolvedDocumentHref,
} from "../../src/ui/lib/documentLinkNavigation";

function linkEvent(
  href: string,
  overrides: Partial<MouseEvent<HTMLElement>> = {},
) {
  const root = document.createElement("article");
  root.innerHTML = `<a><span>Open</span></a>`;
  const link = root.querySelector("a")!;
  link.setAttribute("href", href);
  const event = {
    target: root.querySelector("span"),
    currentTarget: root,
    button: 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as MouseEvent<HTMLElement>;
  return { event, link };
}

function activationOptions() {
  return {
    documentPath: "/workspace/docs/index.md",
    confirmExternalLink: vi.fn().mockResolvedValue(true),
    openDocument: vi.fn().mockResolvedValue(undefined),
    openExternalUrl: vi.fn().mockResolvedValue(undefined),
    resolveDocumentLink: vi.fn().mockResolvedValue({
      status: "resolved",
      path: "/workspace/docs/next.md",
    }),
    navigateFragment: vi.fn(),
    showInlineNotice: vi.fn(),
  };
}

describe("document link navigation boundary", () => {
  it.each([
    ["#usage", { kind: "fragment", fragment: "usage" }],
    ["next.md#usage", { kind: "document", href: "next.md#usage" }],
    [
      " https://example.test/docs ",
      { kind: "external", url: "https://example.test/docs" },
    ],
    ["", { kind: "blocked", reason: "empty" }],
    ["#", { kind: "blocked", reason: "empty" }],
    ["#bad%zz", { kind: "blocked", reason: "malformed" }],
    ["//example.test/docs", { kind: "blocked", reason: "protocol-relative" }],
    ["mailto:user@example.test", { kind: "blocked", reason: "unsupported" }],
    ["javascript:alert(1)", { kind: "blocked", reason: "unsupported" }],
    ["data:text/plain,hello", { kind: "blocked", reason: "unsupported" }],
    ["file:///tmp/guide.md", { kind: "blocked", reason: "unsupported" }],
    ["asset://localhost/guide.md", { kind: "blocked", reason: "unsupported" }],
    ["tauri://localhost/guide.md", { kind: "blocked", reason: "unsupported" }],
    ["custom:guide.md", { kind: "blocked", reason: "unsupported" }],
  ])(
    "classifies %s without using the browser-resolved href",
    (href, expected) => {
      expect(classifyDocumentLinkHref(href)).toEqual(expected);
    },
  );

  it.each([
    { button: 1 },
    { metaKey: true },
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
  ])("prevents disallowed gestures before classification", (gesture) => {
    const { event } = linkEvent("https://example.test/docs", gesture);
    const activation = captureDocumentLinkActivation(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(activation?.intent).toEqual({
      kind: "blocked",
      reason: "disallowed-gesture",
    });
  });

  it("treats an unmodified synthetic click as keyboard activation", () => {
    const { event, link } = linkEvent("next.md", { detail: 0 });

    expect(captureDocumentLinkActivation(event)).toEqual({
      link,
      intent: { kind: "document", href: "next.md" },
    });
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("executes only the explicit action for each allowed intent", async () => {
    const options = activationOptions();

    await activateDocumentLinkIntent(
      { kind: "fragment", fragment: "usage" },
      options,
    );
    expect(options.navigateFragment).toHaveBeenCalledWith("usage", {
      afterDocumentOpen: false,
    });

    await activateDocumentLinkIntent(
      { kind: "external", url: "https://example.test/docs" },
      options,
    );
    expect(options.confirmExternalLink).toHaveBeenCalledWith(
      "https://example.test/docs",
    );
    expect(options.openExternalUrl).toHaveBeenCalledWith(
      "https://example.test/docs",
    );

    await activateDocumentLinkIntent(
      { kind: "document", href: "next.md" },
      options,
    );
    expect(options.resolveDocumentLink).toHaveBeenCalledWith(
      "next.md",
      "/workspace/docs/index.md",
    );
    expect(options.openDocument).toHaveBeenCalledWith(
      "/workspace/docs/next.md",
    );
  });

  it("does not reach any action callback for blocked input", async () => {
    const options = activationOptions();

    await activateDocumentLinkIntent(
      { kind: "blocked", reason: "unsupported" },
      options,
    );

    expect(options.confirmExternalLink).not.toHaveBeenCalled();
    expect(options.openExternalUrl).not.toHaveBeenCalled();
    expect(options.resolveDocumentLink).not.toHaveBeenCalled();
    expect(options.openDocument).not.toHaveBeenCalled();
    expect(options.navigateFragment).not.toHaveBeenCalled();
  });

  it("keeps only fragment and canonical HTTP(S) hrefs without a resolver", () => {
    const body = document.createElement("div");
    body.innerHTML = `<a href="next.md" target="_blank">Doc</a><a href=" https://example.test/docs ">Web</a><a href="#usage">Fragment</a><a href="mailto:user@example.test">Mail</a>`;

    deactivateUnresolvedDocumentLinksInPlace(body);

    const links = Array.from(body.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      null,
      "https://example.test/docs",
      "#usage",
      null,
    ]);
    expect(links[0]?.hasAttribute("target")).toBe(false);
  });

  it("derives a source-relative href without retaining the resolved private path", () => {
    expect(
      relativeResolvedDocumentHref(
        "/workspace/docs/index.md",
        "/workspace/guide/next.md",
        "usage notes",
      ),
    ).toBe("../guide/next.md#usage%20notes");
    expect(
      relativeResolvedDocumentHref(
        "C:\\workspace\\docs\\index.md",
        "D:\\private\\next.md",
        null,
      ),
    ).toBeNull();
  });
});

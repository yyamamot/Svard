import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activateAgentMarkdownLink,
  AgentMarkdownAnswer,
  agentMarkdownLinkTarget,
  SvardOpenUiAnswer,
} from "../../src/ui/codex/openUiLibrary";
import {
  createReactRootHarness,
  type ReactRootHarness,
} from "./helpers/reactHarness";

describe("AgentMarkdownAnswer", () => {
  let interactiveHarness: ReactRootHarness | null = null;

  afterEach(() => {
    interactiveHarness?.cleanup();
    interactiveHarness = null;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("renders standard Markdown without exposing its source markers", () => {
    const html = renderToStaticMarkup(
      <AgentMarkdownAnswer
        content={[
          "Use `docs/guide.md` with **care**.",
          "",
          "- First",
          "- Second",
          "",
          "| Name | State |",
          "| --- | --- |",
          "| Svard | Ready |",
          "",
          "```ts",
          "const ready = true;",
          "```",
        ].join("\n")}
      />,
    );

    expect(html).toContain("<code>docs/guide.md</code>");
    expect(html).toContain("<strong>care</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<table>");
    expect(html).toContain("language-ts");
    expect(html).not.toContain("`docs/guide.md`");
  });

  it("keeps raw HTML inert and removes Markdown image resources", () => {
    const html = renderToStaticMarkup(
      <AgentMarkdownAnswer
        content={
          '<script>alert("x")</script>\n\n![diagram](https://example.com/a.png)'
        }
      />,
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("https://example.com/a.png");
    expect(html).toContain("diagram");
  });

  it("classifies only external and safe workspace-relative links", () => {
    expect(agentMarkdownLinkTarget("docs/guide.md")).toEqual({
      kind: "workspace",
      path: "docs/guide.md",
    });
    expect(agentMarkdownLinkTarget("https://example.com/docs")).toEqual({
      kind: "external",
      url: "https://example.com/docs",
    });
    expect(agentMarkdownLinkTarget("../secret.md")).toBeNull();
    expect(agentMarkdownLinkTarget("/tmp/secret.md")).toBeNull();
    expect(agentMarkdownLinkTarget("javascript:alert(1)")).toBeNull();
    expect(agentMarkdownLinkTarget("docs/%2e%2e/secret.md")).toBeNull();
  });

  it("routes workspace and external links through their callbacks", () => {
    const onOpenFile = vi.fn();
    const onOpenExternalLink = vi.fn();
    const callbacks = { onOpenExternalLink, onOpenFile };

    activateAgentMarkdownLink("docs/guide.md", callbacks);
    activateAgentMarkdownLink("https://example.com/docs", callbacks);
    activateAgentMarkdownLink("javascript:alert(1)", callbacks);

    expect(onOpenFile).toHaveBeenCalledWith("docs/guide.md");
    expect(onOpenExternalLink).toHaveBeenCalledWith("https://example.com/docs");
    expect(onOpenFile).toHaveBeenCalledTimes(1);
    expect(onOpenExternalLink).toHaveBeenCalledTimes(1);
  });

  it("renders incomplete streaming Markdown without throwing", () => {
    expect(() =>
      renderToStaticMarkup(
        <AgentMarkdownAnswer content={"Checking `docs/guide.md"} />,
      ),
    ).not.toThrow();
  });

  it("copies the Markdown answer and exact code block text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    interactiveHarness = createReactRootHarness();
    const content = [
      "## Result",
      "",
      "```ts",
      "const first = true;",
      "```",
      "",
      "```sh",
      "pnpm test",
      "```",
    ].join("\n");
    interactiveHarness.render(<AgentMarkdownAnswer content={content} />);

    await interactiveHarness.click(
      interactiveHarness.container.querySelector(".agent-copy-answer"),
    );
    expect(writeText).toHaveBeenLastCalledWith(content);
    expect(interactiveHarness.container.textContent).toContain("Answer copied");

    const codeButtons =
      interactiveHarness.container.querySelectorAll<HTMLButtonElement>(
        "[data-agent-copy-code]",
      );
    expect(codeButtons).toHaveLength(2);
    await interactiveHarness.click(codeButtons[0]);
    expect(writeText).toHaveBeenLastCalledWith("const first = true;\n");
    await interactiveHarness.click(
      interactiveHarness.container.querySelectorAll<HTMLButtonElement>(
        "[data-agent-copy-code]",
      )[1],
    );
    expect(writeText).toHaveBeenLastCalledWith("pnpm test\n");
  });

  it("hides copy controls while streaming and reports clipboard failure", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    interactiveHarness = createReactRootHarness();
    interactiveHarness.render(
      <AgentMarkdownAnswer content={"```ts\nconst ready = true;\n```"} />,
    );
    await interactiveHarness.click(
      interactiveHarness.container.querySelector(".agent-copy-answer"),
    );
    await vi.waitFor(() =>
      expect(interactiveHarness?.container.textContent).toContain(
        "Copy failed",
      ),
    );

    interactiveHarness.render(
      <AgentMarkdownAnswer
        content={"```ts\nconst ready = false;\n```"}
        isStreaming
      />,
    );
    expect(
      interactiveHarness.container.querySelector(".agent-copy-answer"),
    ).toBeNull();
    expect(
      interactiveHarness.container.querySelector("[data-agent-copy-code]"),
    ).toBeNull();
  });

  it("does not expose Visualize source through copy controls", () => {
    interactiveHarness = createReactRootHarness();
    interactiveHarness.render(
      <SvardOpenUiAnswer
        content={'root = SvardExperience("Summary", "Safe result", [])'}
        isStreaming={false}
        preferUi
        readOnly
      />,
    );

    expect(
      interactiveHarness.container.querySelector(".agent-copy-answer"),
    ).toBeNull();
    expect(
      interactiveHarness.container.querySelector("[data-agent-copy-code]"),
    ).toBeNull();
    expect(interactiveHarness.container.textContent).not.toContain("root =");
  });
});

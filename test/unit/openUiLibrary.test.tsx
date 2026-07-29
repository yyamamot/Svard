import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SvardOpenUiAnswer,
  agentMessageFromOpenUiAction,
  validateOpenUiResponse,
} from "../../src/ui/codex/openUiLibrary";

describe("Svard OpenUI library", () => {
  it("keeps the component allowlist and workspace resource boundary active", () => {
    const valid = validateOpenUiResponse(
      [
        'root = SvardExperience("Files", "Workspace references", [file])',
        'file = OpenFileButton("Open guide", "docs/guide.md")',
      ].join("\n"),
    );
    const escaped = validateOpenUiResponse(
      [
        'root = SvardExperience("Files", "Workspace references", [file])',
        'file = OpenFileButton("Open secret", "../secret.md")',
      ].join("\n"),
    );
    const unknown = validateOpenUiResponse(
      [
        'root = SvardExperience("Unknown", "Unsupported component", [item])',
        'item = RemoteBrowser("Open")',
      ].join("\n"),
    );

    expect(valid.valid, JSON.stringify(valid.meta)).toBe(true);
    expect(escaped).toMatchObject({
      valid: false,
      reason: "resourceBoundary",
    });
    expect(unknown).toMatchObject({
      valid: false,
      reason: "unsupportedComponent",
    });
  });

  it("preserves action mapping while excluding structured form values", () => {
    const message = agentMessageFromOpenUiAction({
      type: "continue_conversation",
      humanFriendlyMessage: "Compare the selected files",
      params: {},
      formState: {
        mode: "summary",
        count: 2,
        enabled: true,
        ignored: { private: "value" },
      },
    });

    expect(message).toBe(
      [
        "Compare the selected files",
        "",
        "Selected values:",
        "- mode: summary",
        "- count: 2",
        "- enabled: true",
      ].join("\n"),
    );
  });

  it("uses the contained fallback for a rejected structured answer", () => {
    const html = renderToStaticMarkup(
      <SvardOpenUiAnswer
        content={[
          'root = SvardExperience("Files", "Workspace references", [file])',
          'file = OpenFileButton("Open secret", "../secret.md")',
        ].join("\n")}
      />,
    );

    expect(html).toContain('data-review-id="agent-openui-fallback"');
    expect(html).toContain('data-openui-failure="resourceBoundary"');
    expect(html).not.toContain("<script");
  });

  it("hides an unexpected structured answer in Auto mode", () => {
    const source =
      'root = SvardExperience("Files", "Workspace references", [])';
    const html = renderToStaticMarkup(
      <SvardOpenUiAnswer allowStructured={false} content={source} />,
    );

    expect(html).toContain('data-openui-failure="modeMismatch"');
    expect(html).not.toContain(source);
  });

  it("renders restored OpenUI as an inert read-only interface", () => {
    const html = renderToStaticMarkup(
      <SvardOpenUiAnswer
        content={[
          'root = SvardExperience("Files", "Workspace references", [file, followup])',
          'file = OpenFileButton("Open guide", "docs/guide.md")',
          'followup = FollowUpButton("Compare", "Compare files")',
        ].join("\n")}
        readOnly
      />,
    );

    expect(html).toContain('data-read-only="true"');
    expect(html).toContain("disabled");
    expect(html).toContain("Open guide");
    expect(html).not.toContain("root = SvardExperience");
  });

  it("renders a scoped profile while rejecting components outside it", () => {
    const source = [
      'root = SvardExperience("Review", "Scoped profile", [summary])',
      'summary = KeyValue([{label:"Status",value:"Ready"}])',
    ].join("\n");
    const rejected = [
      'root = SvardExperience("Review", "Scoped profile", [stat])',
      'stat = StatCard("Coverage", "75%")',
    ].join("\n");

    const html = renderToStaticMarkup(
      <SvardOpenUiAnswer content={source} profile="balanced" />,
    );
    const fallback = renderToStaticMarkup(
      <SvardOpenUiAnswer content={rejected} profile="balanced" />,
    );

    expect(html).toContain('data-review-id="agent-openui-response"');
    expect(html).toContain("Status");
    expect(fallback).toContain('data-openui-failure="unsupportedComponent"');
  });
});

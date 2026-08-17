import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const addedSlugs = [
  "ai-chat",
  "ai-chat-context-access",
  "ai-chat-conversation-review",
  "copy-references-for-ai",
];

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

describe("static site Docs content", () => {
  it("keeps the Japanese and English Docs navigation in parity", () => {
    const ja = read("site/src/content/site.ja.ts");
    const en = read("site/src/content/site.en.ts");

    for (const source of [ja, en]) {
      const reviewIndex = source.indexOf('slug: "ai-agent-change-review"');
      const chatIndex = source.indexOf('slug: "ai-chat"');
      const contextIndex = source.indexOf('slug: "ai-chat-context-access"');
      const reviewConversationIndex = source.indexOf(
        'slug: "ai-chat-conversation-review"',
      );

      expect(reviewIndex).toBeGreaterThan(-1);
      expect(chatIndex).toBeGreaterThan(reviewIndex);
      expect(contextIndex).toBeGreaterThan(chatIndex);
      expect(reviewConversationIndex).toBeGreaterThan(contextIndex);
    }
  });

  it("publishes a localized route for every added feature", () => {
    for (const locale of ["ja", "en"] as const) {
      const chatContent = read(`site/src/content/docs.ai-chat.${locale}.ts`);
      const siteContent = read(`site/src/content/site.${locale}.ts`);
      for (const slug of addedSlugs) {
        expect(siteContent).toContain(`slug: "${slug}"`);
        expect(siteContent).toContain(
          `sitePath("${locale}/docs/features/${slug}/")`,
        );
        expect(
          fs.existsSync(
            path.resolve(
              `site/src/pages/${locale}/docs/features/${slug}/index.astro`,
            ),
          ),
        ).toBe(true);
      }
      expect(chatContent).toContain("aiChat:");
      expect(chatContent).toContain("aiChatContextAccess:");
      expect(chatContent).toContain("aiChatConversationReview:");
      expect(chatContent).toContain("copyReferencesForAi:");
    }
  });

  it("registers every new public screenshot in the manifest", () => {
    const manifest = JSON.parse(
      fs.readFileSync("site/screenshot-manifest.json", "utf8"),
    ) as { captures: Array<{ id: string }> };
    const ids = manifest.captures.map((capture) => capture.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "ai-chat-provider-settings",
        "ai-chat-context-access",
        "ai-chat-session-history",
        "ai-chat-display-review",
        "copy-reference-actions",
        "copy-image-reference",
        "source-control-all-diffs",
        "reading-math-details",
      ]),
    );
  });
});

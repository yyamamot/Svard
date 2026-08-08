export async function recordAgentSelectionMediaChecks({ page, scenario }) {
  if (
    scenario === "viewer-agent-chat-selection" ||
    scenario === "viewer-agent-chat-selection-image"
  ) {
    const submittedTurn = await page.evaluate(
      () => window.__SVARD_AGENT_LAST_TURN_INPUT__,
    );
    await page.evaluate((turn) => {
      const parts = turn?.contentParts ?? [];
      const imageIndex = parts.findIndex((part) => part.type === "image");
      window.__SVARD_AGENT_SELECTION_CHECK__ = {
        historySelections: document.querySelectorAll(
          ".agent-message-selections > span",
        ).length,
        pendingSelections: document.querySelectorAll(".agent-selection-card")
          .length,
        mixedContentOrder:
          imageIndex < 0 ||
          (parts
            .slice(0, imageIndex)
            .some((part) => part.type === "text" && part.text.trim()) &&
            parts
              .slice(imageIndex + 1)
              .some((part) => part.type === "text" && part.text.trim())),
      };
    }, submittedTurn);
  }
  if (scenario === "viewer-agent-chat-media-context") {
    const submittedTurn = await page.evaluate(
      () => window.__SVARD_AGENT_LAST_TURN_INPUT__,
    );
    await page.evaluate((turn) => {
      const parts = turn?.contentParts ?? [];
      const imageIndex = parts.findIndex((part) => part.type === "image");
      window.__SVARD_AGENT_MEDIA_CHECK__ = {
        historyMedia:
          document.querySelectorAll(
            ".agent-message-selections .agent-message-media-thumbnail",
          ).length > 0,
        pendingMedia: document.querySelectorAll(".agent-media-card").length,
        hasLocation: parts.some(
          (part) =>
            part.type === "text" &&
            part.text.includes(
              "Media from docs/asciidoc-comprehensive-visual.adoc",
            ),
        ),
        hasDiagramSource: parts.some(
          (part) =>
            part.type === "text" && part.text.includes("Diagram source"),
        ),
        ordered:
          imageIndex > 0 &&
          parts
            .slice(0, imageIndex)
            .some((part) => part.type === "text" && part.text.trim()) &&
          parts
            .slice(imageIndex + 1)
            .some((part) => part.type === "text" && part.text.trim()),
      };
    }, submittedTurn);
  }
}

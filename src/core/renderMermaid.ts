import type { MermaidDiagram } from "./types";

type MermaidTheme = "light" | "dark";

let initialized = false;
let mermaidModule: Promise<typeof import("mermaid")> | null = null;

async function loadMermaid() {
  mermaidModule ??= import("mermaid");
  const module = await mermaidModule;
  const mermaid = module.default;

  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      htmlLabels: false,
      flowchart: {
        htmlLabels: false,
      },
      theme: "default",
    });
    initialized = true;
  }

  return mermaid;
}

export async function renderMermaidDiagrams(
  diagrams: MermaidDiagram[],
  _theme: MermaidTheme,
) {
  if (diagrams.length === 0) {
    return [];
  }

  const mermaid = await loadMermaid();

  return Promise.all(
    diagrams.map(async (diagram) => {
      const result = await mermaid.render(diagram.id, diagram.source);
      return {
        id: diagram.id,
        svg: result.svg,
      };
    }),
  );
}

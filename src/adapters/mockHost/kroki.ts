import type { HostAdapter, KrokiRequest, KrokiResult } from "../../core/types";

export type MockKrokiFacade = Pick<
  HostAdapter,
  "renderDiagram" | "clearKrokiCache"
>;

export function createMockKrokiFacade(): MockKrokiFacade {
  return {
    renderDiagram,
    clearKrokiCache,
  };
}

const mockKrokiC4Svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="234px" height="258px" viewBox="0 0 234 258" preserveAspectRatio="none" role="img"><rect x="8" y="8" width="218" height="242" rx="8" fill="#e7f0ef" stroke="#287466"/><text x="117" y="78" text-anchor="middle" font-size="16" fill="#173f39">Reviewer</text><text x="117" y="132" text-anchor="middle" font-size="15" fill="#173f39">opens local docs</text><text x="117" y="190" text-anchor="middle" font-size="16" fill="#173f39">Svard</text></svg>';

export async function renderDiagram(input: KrokiRequest): Promise<KrokiResult> {
  if (input.config.mode === "disabled") {
    return {
      status: "disabled",
      message:
        "Kroki is disabled. Configure a self-managed endpoint in Preferences.",
      cacheStatus: "disabled",
    };
  }

  if (input.config.mode === "public" && !input.confirmedRemoteSend) {
    return {
      status: "error",
      message: `${input.config.mode} Kroki rendering requires an explicit per-request confirmation before sending diagram source.`,
      cacheStatus: "not-written",
    };
  }

  if (input.config.mode === "remote") {
    if (input.diagramType === "c4plantuml") {
      return {
        status: "rendered",
        message: "Rendered by mock self-managed Kroki endpoint.",
        mediaType: "image/svg+xml",
        content: mockKrokiC4Svg,
        cacheStatus: "miss",
      };
    }

    if (input.config.outputFormat === "png") {
      return {
        status: "rendered",
        message: "Rendered by mock self-managed Kroki endpoint.",
        mediaType: "image/png",
        content:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lDptXwAAAABJRU5ErkJggg==",
        cacheStatus: "miss",
      };
    }

    return {
      status: "rendered",
      message: "Rendered by mock self-managed Kroki endpoint.",
      mediaType: "image/svg+xml",
      content:
        '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="72" role="img"><rect width="220" height="72" rx="6" fill="#e7f0ef"/><text x="16" y="42" font-size="16" fill="#173f39">Mock Kroki SVG</text></svg>',
      cacheStatus: "miss",
    };
  }

  return {
    status: "error",
    message: "MockHostAdapter does not connect to Kroki endpoints.",
    cacheStatus: "not-written",
  };
}

export async function clearKrokiCache(): Promise<void> {
  // Browser harness has no persistent Kroki cache.
}

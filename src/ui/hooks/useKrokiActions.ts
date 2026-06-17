import type { Dispatch, SetStateAction } from "react";
import type { AppConfig, HostAdapter, KrokiResult } from "../../core/types";
import { clearPlantUmlSvgMemoryCache } from "../../core/renderPlantUml";

const krokiPlantUmlDiagnosticSource = `@startuml
Alice -> Bob: Hello from Kroki
Bob --> Alice: SVG rendered
@enduml`;

export function useKrokiActions({
  host,
  setConfirmedRemoteDiagramKeys,
  setKrokiFallbackDiagramKeys,
  showInlineNotice,
}: {
  host: HostAdapter;
  setConfirmedRemoteDiagramKeys: Dispatch<SetStateAction<ReadonlySet<string>>>;
  setKrokiFallbackDiagramKeys: Dispatch<SetStateAction<ReadonlySet<string>>>;
  showInlineNotice: (
    message: string,
    options?: { tone?: "error" | "info" | "success" | "warning" },
  ) => void;
}) {
  async function clearKrokiCache() {
    await host.clearKrokiCache();
    showInlineNotice("Kroki cache cleared", { tone: "success" });
  }

  async function clearPlantUmlSvgCache() {
    clearPlantUmlSvgMemoryCache();
    await host.clearPlantUmlSvgCache();
    showInlineNotice("Local diagram cache cleared", { tone: "success" });
  }

  async function testKrokiPlantUml(
    nextConfig: AppConfig,
  ): Promise<KrokiResult> {
    return host.renderDiagram({
      diagramType: "plantuml",
      source: krokiPlantUmlDiagnosticSource,
      config: nextConfig.kroki,
      confirmedRemoteSend: true,
    });
  }

  function confirmKrokiRender(key: string) {
    setConfirmedRemoteDiagramKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);
      nextKeys.add(key);
      return nextKeys;
    });
    showInlineNotice("Remote diagram render confirmed for this diagram", {
      tone: "success",
    });
  }

  function tryKrokiFallback(key: string) {
    setKrokiFallbackDiagramKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);
      nextKeys.add(key);
      return nextKeys;
    });
    showInlineNotice("Trying Kroki fallback for this diagram", {
      tone: "info",
    });
  }

  return {
    clearKrokiCache,
    clearPlantUmlSvgCache,
    confirmKrokiRender,
    testKrokiPlantUml,
    tryKrokiFallback,
  };
}

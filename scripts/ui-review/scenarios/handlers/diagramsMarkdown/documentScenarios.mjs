import { applyAsciiDocScenario } from "./documentScenarios/asciidocScenarios.mjs";
import { applyDiagramPreviewScenario } from "./documentScenarios/diagramPreviewScenarios.mjs";
import { applyMarkdownScenario } from "./documentScenarios/markdownScenarios.mjs";
import { applyRendererScenario } from "./documentScenarios/rendererScenarios.mjs";

const DOCUMENT_SCENARIO_GROUPS = [
  applyRendererScenario,
  applyDiagramPreviewScenario,
  applyAsciiDocScenario,
  applyMarkdownScenario,
];

export async function applyDocumentDiagramScenario(context) {
  for (const applyScenario of DOCUMENT_SCENARIO_GROUPS) {
    if (await applyScenario(context)) {
      return true;
    }
  }
  return false;
}

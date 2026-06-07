import { buildAsciiDocAssertions } from "./documentAssertions/asciidocAssertions.mjs";
import { createDocumentAssertionContext } from "./documentAssertions/assertionContext.mjs";
import { buildDiagramPreviewAssertions } from "./documentAssertions/diagramPreviewAssertions.mjs";
import { buildMarkdownAssertions } from "./documentAssertions/markdownAssertions.mjs";
import { buildRendererAssertions } from "./documentAssertions/rendererAssertions.mjs";

export async function buildDocumentDiagramAssertions(context) {
  const assertionContext = await createDocumentAssertionContext(context);
  return {
    ...(await buildRendererAssertions(assertionContext)),
    ...(await buildDiagramPreviewAssertions(assertionContext)),
    ...(await buildAsciiDocAssertions(assertionContext)),
    ...(await buildMarkdownAssertions(assertionContext)),
  };
}

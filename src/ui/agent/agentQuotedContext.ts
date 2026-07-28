import type { AgentQuotedContext } from "../../core/types";
import {
  isDocumentChangeSnapshot,
  isDocumentMediaSnapshot,
} from "../../core/types";
import { selectionSnapshotText } from "../lib/documentSelection";

const maximumQuotedContexts = 8;
const maximumQuotedContextBytes = 1024 * 1024;
const maximumQuotedImages = 4;
const maximumQuotedImageBytes = 20 * 1024 * 1024;

export type AgentQuotedContextAppendResult =
  | { ok: true; contexts: AgentQuotedContext[] }
  | { ok: false; message: string };

export function appendAgentQuotedContext(
  current: AgentQuotedContext[],
  snapshot: AgentQuotedContext,
): AgentQuotedContextAppendResult {
  const blocking = snapshot.diagnostics.find(
    (diagnostic) => diagnostic.severity === "blocking",
  );
  if (blocking) {
    return {
      ok: false,
      message: blocking.message ?? "The quoted content could not be attached.",
    };
  }
  if (current.some((item) => item.snapshotId === snapshot.snapshotId)) {
    return { ok: false, message: "This content is already attached." };
  }
  const contexts = [...current, snapshot];
  if (contexts.length > maximumQuotedContexts) {
    return {
      ok: false,
      message: "Add no more than 8 quoted items to one question.",
    };
  }
  const textBytes = contexts.reduce(
    (total, context) =>
      total +
      new TextEncoder().encode(
        isDocumentMediaSnapshot(context)
          ? (context.diagram?.source ?? "")
          : isDocumentChangeSnapshot(context)
            ? [context.before, context.after]
                .filter((selection) => selection !== undefined)
                .map((selection) => selectionSnapshotText(selection))
                .join("\n")
            : selectionSnapshotText(context),
      ).length,
    0,
  );
  if (textBytes > maximumQuotedContextBytes) {
    return {
      ok: false,
      message: "The selected content for this question is larger than 1 MiB.",
    };
  }
  const images = contexts.flatMap((context) =>
    isDocumentMediaSnapshot(context)
      ? context.visual
        ? [context.visual]
        : []
      : isDocumentChangeSnapshot(context)
        ? [context.before, context.after].flatMap(
            (selection) => selection?.imageResources ?? [],
          )
        : context.imageResources,
  );
  if (images.length > maximumQuotedImages) {
    return {
      ok: false,
      message: "Add no more than 4 images to one question.",
    };
  }
  if (
    images.reduce((total, image) => total + image.byteLength, 0) >
    maximumQuotedImageBytes
  ) {
    return {
      ok: false,
      message: "The images for this question are larger than 20 MiB.",
    };
  }
  return { ok: true, contexts };
}

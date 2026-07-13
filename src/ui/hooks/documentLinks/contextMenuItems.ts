import {
  Copy,
  Crop,
  Download,
  ExternalLink,
  FilePenLine,
  FileText,
  GitCompare,
  Image,
  Link as LinkIcon,
  Maximize2,
} from "lucide-react";
import { isSupportedDocumentPath } from "../../../core/documentFormat";
import type {
  DocumentPayload,
  GitRefKind,
  RenderResult,
} from "../../../core/types";
import { sectionSourceForHeading } from "../../lib/sectionCopy";
import { isExternalUrl, splitPathAndHash } from "../../lib/path";
import type { ContextMenuItem, DiagramPreviewState } from "../../types";
import { isSupportedDocumentHref, menuIcon } from "./shared";
import { addTableItems } from "./tableActions";
import type { CopyText, UseDocumentLinksOptions } from "./types";

type CopyImage = (
  source: HTMLImageElement | SVGElement,
  referenceText?: string,
) => Promise<void>;

export interface OriginalTextReference {
  value: string;
}

export interface DiffReference {
  value: string;
}

export function addSelectionItems(
  items: ContextMenuItem[],
  table: HTMLTableElement | null,
  copyText: CopyText,
  textReference?: string,
  diffReference?: DiffReference,
  originalTextReference?: OriginalTextReference,
) {
  if (textReference) {
    items.push({
      id: "copy-text-reference",
      label: "Copy Text Reference",
      icon: menuIcon(Copy),
      onSelect: () => copyText("Text reference", textReference),
    });
  }
  if (diffReference) {
    items.push({
      id: "copy-diff-reference",
      label: "Copy Diff Reference",
      icon: menuIcon(Copy),
      onSelect: () => copyText("Diff reference", diffReference.value),
    });
  }
  if (originalTextReference) {
    items.push({
      id: "copy-original-text-reference",
      label: "Copy Original Text Reference",
      icon: menuIcon(Copy),
      onSelect: () =>
        copyText("Original text reference", originalTextReference.value),
    });
  }
  if (table) {
    addTableItems(items, table, copyText);
  }
}

export function addTextReferenceItem(
  items: ContextMenuItem[],
  locationReference: string,
  copyText: CopyText,
) {
  items.push({
    id: "copy-text-reference",
    label: "Copy Text Reference",
    icon: menuIcon(Copy),
    onSelect: () => copyText("Text reference", locationReference),
  });
}

export function addDiagramItems(
  items: ContextMenuItem[],
  target: HTMLElement,
  actions: {
    copyText: CopyText;
    openDiagramPreview: (
      svg: SVGElement,
      sourceReference: string | undefined,
      preparedPreview?: DiagramPreviewState,
    ) => void;
    prepareDiagramPreview?: (
      svg: SVGElement,
      sourceReference: string | undefined,
    ) => DiagramPreviewState | undefined;
    saveDiagramSvg: (
      svg: SVGElement,
      sourceReference?: string,
    ) => Promise<void>;
    copyImage: CopyImage;
  },
) {
  const diagram = target.closest<HTMLElement>(".diagram-inline-image");
  const svg = diagram?.querySelector("svg");
  const diagramReference = diagram?.getAttribute("data-source-reference");
  if (svg) {
    const preparedPreview = actions.prepareDiagramPreview?.(
      svg,
      diagramReference ?? undefined,
    );
    items.push({
      id: "open-diagram-preview",
      label: "Open Preview",
      icon: menuIcon(Maximize2),
      onSelect: () =>
        actions.openDiagramPreview(
          svg,
          diagramReference ?? undefined,
          preparedPreview,
        ),
    });
    items.push({
      id: "copy-image",
      label: "Copy Image",
      icon: menuIcon(Image),
      onSelect: () => actions.copyImage(svg),
    });
    items.push({
      id: "save-diagram-svg",
      label: "Save SVG",
      icon: menuIcon(Download),
      onSelect: () =>
        actions.saveDiagramSvg(svg, diagramReference ?? undefined),
    });
    if (diagramReference) {
      items.push({
        id: "copy-diagram-reference",
        label: "Copy Diagram Reference",
        icon: menuIcon(Copy),
        onSelect: () => actions.copyText("Diagram reference", diagramReference),
      });
    }
  }

  const diagramDiagnostic = target.closest<HTMLElement>(
    ".diagram-inline-diagnostic",
  );
  const diagnosticReference = diagramDiagnostic?.getAttribute(
    "data-source-reference",
  );
  if (items.length === 0 && diagnosticReference) {
    items.push({
      id: "copy-diagram-reference",
      label: "Copy Diagram Reference",
      icon: menuIcon(Copy),
      onSelect: () =>
        actions.copyText("Diagram reference", diagnosticReference),
    });
  }
}

export function addSourceItems(
  items: ContextMenuItem[],
  target: HTMLElement,
  copyText: CopyText,
) {
  const sourceFrame = target.closest<HTMLElement>(".source-block-frame");
  if (items.length !== 0 || !sourceFrame) {
    return;
  }
  const source = sourceFrame.querySelector("pre")?.textContent ?? "";
  const sourceReference =
    sourceFrame.getAttribute("data-source-reference") ?? undefined;
  items.push({
    id: "copy-source",
    label: "Copy Source",
    icon: menuIcon(Copy),
    onSelect: () => copyText("Source block", source),
  });
  if (sourceReference) {
    items.push({
      id: "copy-source-reference",
      label: "Copy Source Reference",
      icon: menuIcon(LinkIcon),
      onSelect: () => copyText("Source reference", sourceReference),
    });
  }
}

export function addLinkItems(
  items: ContextMenuItem[],
  target: HTMLElement,
  actions: Pick<
    UseDocumentLinksOptions,
    "documentPayload" | "openPathInEditor" | "resolveDocumentLink"
  > & {
    copyText: CopyText;
    openDocumentInNewWindow?: UseDocumentLinksOptions["openDocumentInNewWindow"];
    openLinkElement: (link: HTMLAnchorElement) => Promise<void>;
    showInlineNotice: UseDocumentLinksOptions["showInlineNotice"];
  },
) {
  const link = target.closest("a[href]") as HTMLAnchorElement | null;
  const href = link?.getAttribute("href") ?? "";
  if (items.length !== 0 || !link || !href) {
    return;
  }
  if (isSupportedDocumentHref(href)) {
    const resolveContextLink = async () => {
      const targetPath = splitPathAndHash(href);
      if (!actions.documentPayload) {
        return { path: targetPath.path, hash: targetPath.hash };
      }
      const resolved = await actions.resolveDocumentLink(
        href,
        actions.documentPayload.path,
      );
      if (resolved.status !== "resolved" || !resolved.path) {
        actions.showInlineNotice(
          resolved.message ?? "Document link is not available",
          { tone: "warning" },
        );
        return null;
      }
      return { path: resolved.path, hash: resolved.hash ?? targetPath.hash };
    };
    items.push({
      id: "open-document",
      label: "Open Document",
      icon: menuIcon(FileText),
      onSelect: () => actions.openLinkElement(link),
    });
    if (actions.openDocumentInNewWindow) {
      items.push({
        id: "open-link-in-new-window",
        label: "Open Link in New Window",
        icon: menuIcon(FileText),
        onSelect: async () => {
          const resolved = await resolveContextLink();
          if (resolved && isSupportedDocumentPath(resolved.path)) {
            await actions.openDocumentInNewWindow?.(resolved.path);
          }
        },
      });
    }
    items.push({
      id: "open-in-editor",
      label: "Open in Editor",
      icon: menuIcon(FilePenLine),
      onSelect: async () => {
        const resolved = await resolveContextLink();
        if (resolved) {
          await actions.openPathInEditor(resolved.path);
        }
      },
    });
    items.push({
      id: "copy-path",
      label: "Copy Path",
      icon: menuIcon(Copy),
      onSelect: async () => {
        const resolved = await resolveContextLink();
        if (resolved) {
          await actions.copyText(
            "Path",
            resolved.hash ? `${resolved.path}#${resolved.hash}` : resolved.path,
          );
        }
      },
    });
  } else if (isExternalUrl(href)) {
    items.push({
      id: "open-link",
      label: "Open Link",
      icon: menuIcon(ExternalLink),
      onSelect: () => actions.openLinkElement(link),
    });
    items.push({
      id: "copy-link",
      label: "Copy Link",
      icon: menuIcon(Copy),
      onSelect: () => actions.copyText("Link", href),
    });
  }
}

export function addImageItems(
  items: ContextMenuItem[],
  target: HTMLElement,
  actions: {
    copyText: CopyText;
    openImagePreview: (image: HTMLImageElement) => void;
    copyImage: CopyImage;
  },
  referenceText?: string,
) {
  const image = target.closest("img") as HTMLImageElement | null;
  if (items.length !== 0 || !image) {
    return;
  }
  const imagePath = image.getAttribute("data-image-resolved-path") ?? undefined;
  const imageUrl = image.getAttribute("data-image-url") ?? undefined;
  items.push({
    id: "open-image-preview",
    label: "Open Preview",
    icon: menuIcon(Maximize2),
    onSelect: () => actions.openImagePreview(image),
  });
  items.push({
    id: "copy-image",
    label: "Copy Image",
    icon: menuIcon(Image),
    onSelect: () => actions.copyImage(image),
  });
  if (referenceText) {
    items.push({
      id: "copy-image-with-reference",
      label: "Copy Image with Reference",
      icon: menuIcon(Image),
      onSelect: () => actions.copyImage(image, referenceText),
    });
  }
  if (imagePath) {
    items.push({
      id: "copy-image-path",
      label: "Copy Image Path",
      icon: menuIcon(Copy),
      onSelect: () => actions.copyText("Image path", imagePath),
    });
  } else if (imageUrl) {
    items.push({
      id: "copy-image-url",
      label: "Copy Image URL",
      icon: menuIcon(Copy),
      onSelect: () => actions.copyText("Image URL", imageUrl),
    });
  }
}

export function addHeadingItems(
  items: ContextMenuItem[],
  target: HTMLElement,
  documentPayload: DocumentPayload | null,
  copyText: CopyText,
  options: {
    renderResult?: RenderResult | null;
    includeSectionCopy?: boolean;
  } = {},
) {
  const heading = target.closest<HTMLElement>("h1,h2,h3,h4,h5,h6");
  if (items.length !== 0 || !heading?.id || !documentPayload) {
    return;
  }
  const sourceReference =
    heading.getAttribute("data-source-reference") ?? undefined;
  const sectionItems: ContextMenuItem[] = [];
  if (options.includeSectionCopy && options.renderResult) {
    const sectionSource = sectionSourceForHeading({
      documentPayload,
      headingId: heading.id,
      headings: options.renderResult.headings,
    });
    if (sectionSource) {
      sectionItems.push({
        id: "copy-section",
        label: "Copy Section",
        icon: menuIcon(Copy),
        onSelect: () => copyText("Section", sectionSource),
      });
    }
    if (sourceReference) {
      sectionItems.push({
        id: "copy-section-reference",
        label: "Copy Section Reference",
        icon: menuIcon(LinkIcon),
        onSelect: () => copyText("Section reference", sourceReference),
      });
    }
  }
  items.push({
    id: "copy-heading-link",
    label: "Copy Heading Link",
    icon: menuIcon(LinkIcon),
    onSelect: () =>
      copyText(
        "Heading link",
        sourceReference ??
          `${documentPayload.path}#${encodeURIComponent(heading.id)}`,
      ),
  });
  if (sourceReference) {
    items.push({
      id: "copy-source-reference",
      label: "Copy Source Reference",
      icon: menuIcon(Copy),
      onSelect: () => copyText("Source reference", sourceReference),
    });
  }
  if (sectionItems.length > 0) {
    sectionItems[0] = { ...sectionItems[0], separatorBefore: true };
    items.push(...sectionItems);
  }
}

export function addDocumentItems(
  items: ContextMenuItem[],
  documentPayload: DocumentPayload | null,
  actions: {
    copyText: CopyText;
    onCompareGitRef: (kind: GitRefKind, path: string) => void | Promise<void>;
    onShowGitDiff: (path: string) => void | Promise<void>;
    openPathInEditor: (path: string) => Promise<void>;
  },
  allowExistingItems = false,
) {
  if ((items.length !== 0 && !allowExistingItems) || !documentPayload) {
    return;
  }
  if (isSupportedDocumentPath(documentPayload.path)) {
    items.push({
      id: "open-in-editor",
      label: "Open in Editor",
      icon: menuIcon(FilePenLine),
      onSelect: () => actions.openPathInEditor(documentPayload.path),
    });
    items.push({
      id: "show-git-diff",
      label: "Show Git Diff",
      icon: menuIcon(GitCompare),
      onSelect: () => actions.onShowGitDiff(documentPayload.path),
    });
    items.push({
      id: "compare-with-branch",
      label: "Compare with Branch...",
      icon: menuIcon(GitCompare),
      onSelect: () => actions.onCompareGitRef("branch", documentPayload.path),
    });
    items.push({
      id: "compare-with-tag",
      label: "Compare with Tag...",
      icon: menuIcon(GitCompare),
      onSelect: () => actions.onCompareGitRef("tag", documentPayload.path),
    });
    items.push({
      id: "compare-with-commit",
      label: "Compare with Commit...",
      icon: menuIcon(GitCompare),
      onSelect: () => actions.onCompareGitRef("commit", documentPayload.path),
    });
  }
  items.push({
    id: "copy-document-path",
    label: "Copy Document Path",
    icon: menuIcon(Copy),
    onSelect: () => actions.copyText("Path", documentPayload.path),
  });
}

export function addCaptureAreaItem(
  items: ContextMenuItem[],
  onBeginCaptureArea: () => void,
  onBeginCaptureAreaWithReference?: () => void,
) {
  items.push({
    id: "capture-area",
    label: "Capture Area…",
    icon: menuIcon(Crop),
    separatorBefore: items.length > 0,
    onSelect: onBeginCaptureArea,
  });
  if (onBeginCaptureAreaWithReference) {
    items.push({
      id: "capture-area-with-reference",
      label: "Capture Area with Reference…",
      icon: menuIcon(Crop),
      onSelect: onBeginCaptureAreaWithReference,
    });
  }
}

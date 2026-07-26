import { createParser, type ActionEvent } from "@openuidev/react-lang";
import {
  MAX_CHART_SERIES,
  MAX_GALLERY_IMAGES,
  MAX_OPENUI_CHART_POINTS,
  MAX_OPENUI_DEPTH,
  MAX_OPENUI_NODES,
  MAX_OPENUI_SOURCE_BYTES,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
} from "./openUiLimits";
import { svardOpenUiLibrary } from "./openUiRegistry";

function openUiCandidate(content: string): string | null {
  const fenced = content.match(/```(?:openui|openui-lang)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? content).trim();
  return /\broot\s*=\s*SvardExperience\s*\(/.test(candidate) ? candidate : null;
}

export function openUiLooksLikeCandidate(content: string) {
  const trimmed = content.trimStart();
  return (
    /^```(?:openui|openui-lang)?/i.test(trimmed) ||
    /\broot\s*=/u.test(trimmed) ||
    /\bSvardExperience\s*\(/u.test(trimmed)
  );
}

function validateRelativeResource(value: string) {
  const normalized = value.replaceAll("\\", "/").trim();
  return Boolean(
    normalized &&
    !normalized.startsWith("/") &&
    !/^[a-z]:\//iu.test(normalized) &&
    !normalized.split("/").some((segment) => segment === "..") &&
    !/^[a-z][a-z0-9+.-]*:/iu.test(normalized),
  );
}

export type OpenUiFailureReason =
  | "sourceLimit"
  | "missingRoot"
  | "incomplete"
  | "forbiddenContent"
  | "syntax"
  | "unsupportedComponent"
  | "forbiddenOperation"
  | "resourceBoundary"
  | "complexityLimit"
  | "renderer";

export interface OpenUiLimitDiagnostic {
  metric:
    | "sourceBytes"
    | "nodes"
    | "depth"
    | "tableColumns"
    | "tableRows"
    | "chartSeries"
    | "chartPoints"
    | "galleryImages";
  label: string;
  actual: number;
  limit: number;
}

type OpenUiTreeInspection =
  | { valid: true }
  | {
      valid: false;
      reason: "resourceBoundary" | "complexityLimit";
      limitDiagnostic: OpenUiLimitDiagnostic | null;
    };

function inspectElementTree(root: unknown): OpenUiTreeInspection {
  let nodes = 0;
  let reason: "resourceBoundary" | "complexityLimit" | null = null;
  let limitDiagnostic: OpenUiLimitDiagnostic | null = null;
  const exceed = (
    metric: OpenUiLimitDiagnostic["metric"],
    label: string,
    actual: number,
    limit: number,
  ) => {
    reason = "complexityLimit";
    limitDiagnostic = { metric, label, actual, limit };
  };
  const visit = (value: unknown, depth: number) => {
    if (reason || value === null || typeof value !== "object") return;
    if (depth > MAX_OPENUI_DEPTH) {
      exceed("depth", "Nesting depth", depth, MAX_OPENUI_DEPTH);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth);
      return;
    }
    const record = value as Record<string, unknown>;
    if (record.type === "element") {
      nodes += 1;
      if (nodes > MAX_OPENUI_NODES) {
        exceed("nodes", "UI components", nodes, MAX_OPENUI_NODES);
        return;
      }
      const typeName = String(record.typeName ?? "");
      const props = (record.props ?? {}) as Record<string, unknown>;
      if (
        ["FileReference", "FileList", "FileMap", "OpenFileButton"].includes(
          typeName,
        )
      ) {
        const paths = [
          props.path,
          ...(Array.isArray(props.files)
            ? props.files.map((file) => (file as Record<string, unknown>).path)
            : []),
          ...(Array.isArray(props.nodes)
            ? props.nodes.map((node) => (node as Record<string, unknown>).path)
            : []),
        ].filter((path): path is string => typeof path === "string");
        if (!paths.every(validateRelativeResource)) {
          reason = "resourceBoundary";
        }
      }
      if (["Image", "ImageBlock"].includes(typeName)) {
        const valid =
          typeof props.source === "string" &&
          (props.kind === "attached" ||
            (props.kind === "workspace" &&
              validateRelativeResource(props.source)));
        if (!valid) reason = "resourceBoundary";
      }
      if (
        typeName === "ImageGallery" &&
        Array.isArray(props.images) &&
        props.images.length > MAX_GALLERY_IMAGES
      ) {
        exceed(
          "galleryImages",
          "Gallery images",
          props.images.length,
          MAX_GALLERY_IMAGES,
        );
      }
      if (typeName === "Table" && Array.isArray(props.columns)) {
        if (props.columns.length > MAX_TABLE_COLUMNS) {
          exceed(
            "tableColumns",
            "Table columns",
            props.columns.length,
            MAX_TABLE_COLUMNS,
          );
        }
        const tableRows = Math.max(
          0,
          ...props.columns.map((column) => {
            const data = (column as Record<string, unknown>).data;
            return Array.isArray(data) ? data.length : 0;
          }),
        );
        if (!reason && tableRows > MAX_TABLE_ROWS) {
          exceed("tableRows", "Table rows", tableRows, MAX_TABLE_ROWS);
        }
      }
      if (/Chart$/u.test(typeName)) {
        if (
          Array.isArray(props.series) &&
          props.series.length > MAX_CHART_SERIES
        ) {
          exceed(
            "chartSeries",
            "Chart series",
            props.series.length,
            MAX_CHART_SERIES,
          );
        }
        const chartPoints = Math.max(
          Array.isArray(props.labels) ? props.labels.length : 0,
          ...(Array.isArray(props.series)
            ? props.series.map((series) => {
                const record = series as Record<string, unknown>;
                const points = record.values ?? record.data;
                return Array.isArray(points) ? points.length : 0;
              })
            : [0]),
        );
        if (!reason && chartPoints > MAX_OPENUI_CHART_POINTS) {
          exceed(
            "chartPoints",
            "Chart points",
            chartPoints,
            MAX_OPENUI_CHART_POINTS,
          );
        }
      }
    }
    for (const child of Object.values(record)) visit(child, depth + 1);
  };
  visit(root, 1);
  return reason ? { valid: false, reason, limitDiagnostic } : { valid: true };
}

export function validateOpenUiResponse(content: string): {
  candidate: string | null;
  valid: boolean;
  incomplete: boolean;
  reason: OpenUiFailureReason | null;
  limitDiagnostic: OpenUiLimitDiagnostic | null;
  meta: unknown;
} {
  const sourceBytes = new TextEncoder().encode(content).length;
  if (sourceBytes > MAX_OPENUI_SOURCE_BYTES) {
    return {
      candidate: null,
      valid: false,
      incomplete: false,
      reason: "sourceLimit",
      limitDiagnostic: {
        metric: "sourceBytes",
        label: "Response size",
        actual: sourceBytes,
        limit: MAX_OPENUI_SOURCE_BYTES,
      },
      meta: null,
    };
  }
  const candidate = openUiCandidate(content);
  if (!candidate) {
    return {
      candidate: null,
      valid: false,
      incomplete: openUiLooksLikeCandidate(content),
      reason: openUiLooksLikeCandidate(content) ? "incomplete" : "missingRoot",
      limitDiagnostic: null,
      meta: null,
    };
  }
  if (/\b(?:Query|Mutation)\s*\(/u.test(candidate)) {
    return {
      candidate,
      valid: false,
      incomplete: false,
      reason: "forbiddenOperation",
      limitDiagnostic: null,
      meta: null,
    };
  }
  if (/(?:https?:\/\/|data:|javascript:|<script|<iframe)/iu.test(candidate)) {
    return {
      candidate,
      valid: false,
      incomplete: false,
      reason: "forbiddenContent",
      limitDiagnostic: null,
      meta: null,
    };
  }
  const result = createParser(
    svardOpenUiLibrary.toJSONSchema(),
    svardOpenUiLibrary.root,
  ).parse(candidate);
  const tree = result.root ? inspectElementTree(result.root) : null;
  const reason: OpenUiFailureReason | null = result.meta.incomplete
    ? "incomplete"
    : result.meta.unresolved.length > 0 ||
        result.meta.errors.some((error) => error.code === "unknown-component")
      ? "unsupportedComponent"
      : result.meta.errors.length > 0 || !result.root
        ? "syntax"
        : result.queryStatements.length > 0 ||
            result.mutationStatements.length > 0
          ? "forbiddenOperation"
          : tree && !tree.valid
            ? tree.reason
            : null;
  return {
    candidate,
    valid: reason === null,
    incomplete: result.meta.incomplete,
    reason,
    limitDiagnostic: tree && !tree.valid ? tree.limitDiagnostic : null,
    meta: result.meta,
  };
}

export function agentMessageFromOpenUiAction(event: ActionEvent) {
  if (event.type !== "continue_conversation") return null;
  const message = event.humanFriendlyMessage.trim();
  if (!message) return null;
  const state = Object.entries(event.formState ?? {})
    .filter(([, value]) =>
      ["string", "number", "boolean"].includes(typeof value),
    )
    .slice(0, 40);
  if (state.length === 0) return message.slice(0, 8 * 1024);
  const values = state
    .map(([key, value]) => `- ${key}: ${String(value)}`)
    .join("\n");
  return `${message}\n\nSelected values:\n${values}`.slice(0, 8 * 1024);
}

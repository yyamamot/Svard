import type {
  AsciiDocIncludeFile,
  RenderDiagnostic,
  SourceLocation,
} from "./types";

export interface SourceLineOrigin {
  sourcePath: string;
  line: number;
}

export interface ExpandedAsciiDoc {
  source: string;
  lineOrigins: SourceLineOrigin[];
  diagnostics: RenderDiagnostic[];
}

const includePattern = /^(\s*)include::([^[]+)\[([^\]]*)\]\s*$/;
const urlPattern = /^[a-z][a-z0-9+.-]*:/i;
const maxIncludeDepth = 12;

function normalizePath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const root = pathRoot(normalized);
  const withoutRoot = root ? normalized.slice(root.length) : normalized;
  const parts: string[] = [];
  for (const part of withoutRoot.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  const joined = parts.join("/");
  return root ? (joined ? `${root}${joined}` : root) : joined || ".";
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  const root = pathRoot(normalized);
  if (normalized === root) {
    return root;
  }
  const index = normalized.lastIndexOf("/");
  if (index < root.length) {
    return root || ".";
  }
  return normalized.slice(0, index);
}

function resolveIncludePath(basePath: string, target: string): string | null {
  const cleanTarget = target.trim();
  if (
    !cleanTarget ||
    isAbsolutePathLike(cleanTarget) ||
    urlPattern.test(cleanTarget)
  ) {
    return null;
  }
  return normalizePath(`${basePath}/${cleanTarget}`);
}

function isAbsolutePathLike(path: string): boolean {
  return (
    path.startsWith("/") ||
    /^[A-Za-z]:[\\/]/u.test(path) ||
    /^[\\/]{2}[^\\/]+[\\/][^\\/]+/u.test(path)
  );
}

function pathRoot(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const driveRoot = normalized.match(/^[A-Za-z]:\/?/u);
  if (driveRoot) {
    return `${driveRoot[0].slice(0, 2)}/`;
  }
  const uncRoot = normalized.match(/^\/\/[^/]+\/[^/]+\/?/u);
  if (uncRoot) {
    return uncRoot[0].replace(/\/?$/u, "/");
  }
  return normalized.startsWith("/") ? "/" : "";
}

function parseLevelOffset(attributes: string): number | null {
  const match = /(?:^|,)\s*leveloffset\s*=\s*([+-]?\d+)\s*(?:,|$)/.exec(
    attributes,
  );
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function levelOffsetValue(offset: number): string {
  return offset > 0 ? `+${offset}` : String(offset);
}

function pushSyntheticLine(
  outputLines: string[],
  origins: SourceLineOrigin[],
  line: string,
  currentPath: string,
  lineNumber: number,
): void {
  outputLines.push(line);
  origins.push({ sourcePath: currentPath, line: lineNumber });
}

function pushBoundaryBlank(
  outputLines: string[],
  origins: SourceLineOrigin[],
  currentPath: string,
  lineNumber: number,
): void {
  if (outputLines.length === 0 || outputLines[outputLines.length - 1] === "") {
    return;
  }
  pushSyntheticLine(outputLines, origins, "", currentPath, lineNumber);
}

function diagnostic(
  id: string,
  message: string,
  sourcePath: string,
  line: number,
): RenderDiagnostic {
  return {
    id,
    severity: "warning",
    message,
    sourceLocation: { sourcePath, line, column: 1 },
  };
}

export function expandAsciiDocIncludes(
  source: string,
  rootPath: string | undefined,
  includeFiles: AsciiDocIncludeFile[] = [],
): ExpandedAsciiDoc {
  const rootSourcePath = rootPath ?? "<document>";
  const includeMap = new Map(
    includeFiles.map((file) => [normalizePath(file.path), file.source]),
  );
  const diagnostics: RenderDiagnostic[] = [];
  let diagnosticCounter = 1;

  function expand(
    currentSource: string,
    currentPath: string,
    stack: string[],
    depth: number,
    activeLevelOffset = 0,
  ): { lines: string[]; origins: SourceLineOrigin[] } {
    const lines = currentSource.split("\n");
    const outputLines: string[] = [];
    const origins: SourceLineOrigin[] = [];
    let inDelimitedBlock = false;

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmed = line.trim();
      if (trimmed === "----" || trimmed === "....") {
        inDelimitedBlock = !inDelimitedBlock;
      }

      const levelOffsetDirective = /^:leveloffset:\s*([+-]?\d+)\s*$/.exec(
        trimmed,
      );
      if (!inDelimitedBlock && levelOffsetDirective) {
        const nextOffset = Number(levelOffsetDirective[1]);
        if (Number.isFinite(nextOffset)) {
          activeLevelOffset += nextOffset;
        }
        pushBoundaryBlank(outputLines, origins, currentPath, lineNumber);
        pushSyntheticLine(outputLines, origins, line, currentPath, lineNumber);
        pushSyntheticLine(outputLines, origins, "", currentPath, lineNumber);
        return;
      }

      const match = includePattern.exec(line);
      if (!match) {
        outputLines.push(line);
        origins.push({ sourcePath: currentPath, line: lineNumber });
        return;
      }

      const target = match[2].trim();
      const attributes = match[3] ?? "";
      const resolved = resolveIncludePath(dirname(currentPath), target);
      if (!resolved) {
        diagnostics.push(
          diagnostic(
            `include-${diagnosticCounter++}`,
            `Unsupported or unsafe include target: ${target}`,
            currentPath,
            lineNumber,
          ),
        );
        outputLines.push("");
        origins.push({ sourcePath: currentPath, line: lineNumber });
        return;
      }
      if (stack.includes(resolved)) {
        diagnostics.push(
          diagnostic(
            `include-${diagnosticCounter++}`,
            `Recursive include skipped: ${target}`,
            currentPath,
            lineNumber,
          ),
        );
        outputLines.push("");
        origins.push({ sourcePath: currentPath, line: lineNumber });
        return;
      }
      if (depth >= maxIncludeDepth) {
        diagnostics.push(
          diagnostic(
            `include-${diagnosticCounter++}`,
            `Include depth limit exceeded: ${target}`,
            currentPath,
            lineNumber,
          ),
        );
        outputLines.push("");
        origins.push({ sourcePath: currentPath, line: lineNumber });
        return;
      }
      const includeSource = includeMap.get(resolved);
      if (includeSource === undefined) {
        diagnostics.push(
          diagnostic(
            `include-${diagnosticCounter++}`,
            `Include file not found or not allowed: ${target}`,
            currentPath,
            lineNumber,
          ),
        );
        outputLines.push("");
        origins.push({ sourcePath: currentPath, line: lineNumber });
        return;
      }

      if (inDelimitedBlock) {
        const includeLines = includeSource.split("\n");
        outputLines.push(...includeLines);
        origins.push(
          ...includeLines.map((_, includeIndex) => ({
            sourcePath: resolved,
            line: includeIndex + 1,
          })),
        );
        return;
      }

      const levelOffset = parseLevelOffset(attributes);
      if (
        levelOffset === null &&
        activeLevelOffset === 0 &&
        /^=\s+\S/m.test(includeSource)
      ) {
        diagnostics.push(
          diagnostic(
            `include-${diagnosticCounter++}`,
            `Included document has a top-level title without leveloffset: ${target}`,
            currentPath,
            lineNumber,
          ),
        );
      }
      if (levelOffset !== null) {
        pushBoundaryBlank(outputLines, origins, currentPath, lineNumber);
        pushSyntheticLine(
          outputLines,
          origins,
          `:leveloffset: ${levelOffsetValue(levelOffset)}`,
          currentPath,
          lineNumber,
        );
        pushSyntheticLine(outputLines, origins, "", currentPath, lineNumber);
      }

      const expanded = expand(
        includeSource,
        resolved,
        [...stack, resolved],
        depth + 1,
        activeLevelOffset + (levelOffset ?? 0),
      );
      outputLines.push(...expanded.lines);
      origins.push(...expanded.origins);

      if (levelOffset !== null) {
        pushBoundaryBlank(outputLines, origins, currentPath, lineNumber);
        pushSyntheticLine(
          outputLines,
          origins,
          `:leveloffset: ${levelOffsetValue(-levelOffset)}`,
          currentPath,
          lineNumber,
        );
        pushSyntheticLine(outputLines, origins, "", currentPath, lineNumber);
      }
    });

    return { lines: outputLines, origins };
  }

  const expanded = expand(source, rootSourcePath, [rootSourcePath], 0);
  return {
    source: expanded.lines.join("\n"),
    lineOrigins: expanded.origins,
    diagnostics,
  };
}

export function mapExpandedLocation(
  location: SourceLocation,
  lineOrigins: SourceLineOrigin[] | undefined,
): SourceLocation {
  if (!location.line || !lineOrigins) {
    return location;
  }
  const origin = lineOrigins[location.line - 1];
  if (!origin) {
    return location;
  }
  return {
    ...location,
    line: origin.line,
    sourcePath: origin.sourcePath,
  };
}

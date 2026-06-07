import { isCommandId } from "./commands";
import type { CommandId } from "./commands";
import type { MouseGestureMappingConfig, MouseGesturesConfig } from "./types";

export type MouseGestureDirection = "Left" | "Right" | "Up" | "Down";
export type MouseGesturePattern = string;

export interface GesturePoint {
  x: number;
  y: number;
}

export interface MouseGestureMapping {
  pattern: MouseGesturePattern;
  commandId: CommandId;
}

export interface MouseGestureResolution {
  pattern: MouseGesturePattern;
  commandId?: CommandId;
}

export const mouseGestureMappings: MouseGestureMappingConfig[] = [
  { pattern: "Left", commandId: "navigation.back" },
  { pattern: "Right", commandId: "navigation.forward" },
  { pattern: "Up", commandId: "viewer.top" },
  { pattern: "Down", commandId: "viewer.bottom" },
  { pattern: "Up Down", commandId: "viewer.reload" },
  { pattern: "Down Right", commandId: "tab.close" },
  { pattern: "Down Left", commandId: "tab.restoreClosed" },
  { pattern: "Up Left", commandId: "tab.previous" },
  { pattern: "Up Right", commandId: "tab.next" },
  { pattern: "Right Down", commandId: "quickOpen.focus" },
];

const defaultMouseGestureCommandIds = new Set(
  mouseGestureMappings.map((mapping) => mapping.commandId),
);

export const defaultMouseGestureConfig: MouseGesturesConfig = {
  enabled: false,
  trigger: "rightButton",
  showTrail: true,
  minDistancePx: 32,
  mappings: mouseGestureMappings.map((mapping) => ({
    ...mapping,
    builtIn: true,
  })),
};

export function normalizeMouseGesturePattern(pattern: string): string {
  const directions = pattern.trim().split(/\s+/).filter(Boolean).slice(0, 3);

  if (
    directions.some(
      (direction) =>
        direction !== "Left" &&
        direction !== "Right" &&
        direction !== "Up" &&
        direction !== "Down",
    )
  ) {
    return "";
  }

  return directions.join(" ");
}

export function normalizeMouseGestureMappings(
  mappings: MouseGestureMappingConfig[] | undefined,
): MouseGestureMappingConfig[] {
  if (!mappings?.length) {
    return defaultMouseGestureConfig.mappings.map((mapping) => ({
      ...mapping,
    }));
  }

  const normalized = mappings
    .map((mapping) => ({
      pattern: normalizeMouseGesturePattern(mapping.pattern),
      commandId: isCommandId(mapping.commandId)
        ? mapping.commandId
        : "navigation.back",
      builtIn: mapping.builtIn === true,
    }))
    .filter((mapping) => mapping.pattern || mapping.builtIn);
  const normalizedByCommand = new Map(
    normalized.map((mapping) => [mapping.commandId, mapping]),
  );
  const defaultRows = mouseGestureMappings.map((defaultMapping) => {
    const saved = normalizedByCommand.get(defaultMapping.commandId);
    return {
      ...defaultMapping,
      pattern: saved?.pattern ?? defaultMapping.pattern,
      builtIn: true,
    };
  });
  const extraRows = normalized.filter(
    (mapping) =>
      !defaultMouseGestureCommandIds.has(mapping.commandId) && mapping.pattern,
  );

  return [...defaultRows, ...extraRows];
}

export function duplicateMouseGesturePatterns(
  mappings: MouseGestureMappingConfig[],
): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const mapping of mappings) {
    const pattern = normalizeMouseGesturePattern(mapping.pattern);
    if (!pattern) {
      continue;
    }
    if (seen.has(pattern)) {
      duplicates.add(pattern);
    }
    seen.add(pattern);
  }
  return duplicates;
}

export function normalizeMouseGesture(
  points: GesturePoint[],
  minDistancePx: number,
): MouseGestureDirection[] {
  const directions: MouseGestureDirection[] = [];
  const threshold = Math.max(1, minDistancePx);
  let anchor = points[0];

  if (!anchor) {
    return directions;
  }

  for (const point of points.slice(1)) {
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) < threshold) {
      continue;
    }

    const direction: MouseGestureDirection =
      absX >= absY ? (dx < 0 ? "Left" : "Right") : dy < 0 ? "Up" : "Down";

    if (directions.at(-1) !== direction) {
      directions.push(direction);
    }

    anchor = point;
    if (directions.length >= 3) {
      break;
    }
  }

  return directions;
}

export function resolveMouseGesture(
  points: GesturePoint[],
  minDistancePx: number,
  mappings: MouseGestureMappingConfig[] = defaultMouseGestureConfig.mappings,
): MouseGestureResolution {
  const pattern = normalizeMouseGesture(points, minDistancePx).join(" ");
  const normalizedMappings = normalizeMouseGestureMappings(mappings);
  return {
    pattern,
    commandId: normalizedMappings.find((mapping) => mapping.pattern === pattern)
      ?.commandId,
  };
}

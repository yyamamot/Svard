export interface BoundedTabsResult {
  visiblePaths: string[];
  overflowPaths: string[];
}

export function getBoundedTabs(
  paths: string[],
  activePath: string | null | undefined,
  maxVisible = 6,
): BoundedTabsResult {
  if (paths.length <= maxVisible) {
    return { visiblePaths: paths, overflowPaths: [] };
  }

  const visible = new Set<string>();
  if (activePath && paths.includes(activePath)) {
    visible.add(activePath);
  }

  for (const path of [...paths].reverse()) {
    if (visible.size >= maxVisible) {
      break;
    }
    visible.add(path);
  }

  return {
    visiblePaths: paths.filter((path) => visible.has(path)),
    overflowPaths: paths.filter((path) => !visible.has(path)),
  };
}

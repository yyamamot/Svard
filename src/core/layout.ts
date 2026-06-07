export interface SidebarLayoutConfig {
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  openFilesHeight: number;
  openFilesCollapsed: boolean;
}

export const defaultSidebarLayout: SidebarLayoutConfig = {
  leftSidebarWidth: 260,
  rightSidebarWidth: 320,
  openFilesHeight: 144,
  openFilesCollapsed: false,
};

export const sidebarLayoutBounds = {
  left: { min: 220, max: 520 },
  right: { min: 240, max: 520 },
  openFiles: { min: 96, max: 420 },
} as const;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeSidebarLayout(
  layout: Partial<SidebarLayoutConfig> | null | undefined,
): SidebarLayoutConfig {
  return {
    leftSidebarWidth: clamp(
      layout?.leftSidebarWidth ?? defaultSidebarLayout.leftSidebarWidth,
      sidebarLayoutBounds.left.min,
      sidebarLayoutBounds.left.max,
    ),
    rightSidebarWidth: clamp(
      layout?.rightSidebarWidth ?? defaultSidebarLayout.rightSidebarWidth,
      sidebarLayoutBounds.right.min,
      sidebarLayoutBounds.right.max,
    ),
    openFilesHeight: clamp(
      layout?.openFilesHeight ?? defaultSidebarLayout.openFilesHeight,
      sidebarLayoutBounds.openFiles.min,
      sidebarLayoutBounds.openFiles.max,
    ),
    openFilesCollapsed: layout?.openFilesCollapsed === true,
  };
}

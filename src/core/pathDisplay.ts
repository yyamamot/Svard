export function pathBasename(path: string): string {
  if (!path) {
    return path;
  }
  if (isSeparatorOnly(path) || isWindowsDriveRoot(path) || isUncRoot(path)) {
    return path;
  }

  const trimmed = path.replace(/[\\/]+$/u, "");
  if (!trimmed) {
    return path;
  }
  return trimmed.split(/[\\/]/u).filter(Boolean).at(-1) ?? path;
}

function isSeparatorOnly(path: string): boolean {
  return /^[\\/]+$/u.test(path);
}

function isWindowsDriveRoot(path: string): boolean {
  return /^[A-Za-z]:[\\/]?$/u.test(path);
}

function isUncRoot(path: string): boolean {
  const trimmed = path.replace(/[\\/]+$/u, "");
  if (!/^[\\/]{2}/u.test(trimmed)) {
    return false;
  }
  return trimmed.split(/[\\/]+/u).filter(Boolean).length <= 2;
}

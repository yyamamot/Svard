const rawBase = import.meta.env.BASE_URL || '/';

export const basePath = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

export function sitePath(path: string) {
  const normalized = path.replace(/^\/+/, '');
  return `${basePath}${normalized}`;
}

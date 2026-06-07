import { existsSync } from 'node:fs';
import { sitePath } from './paths';

export function screenshot(name: string, title: string, body: string, alt?: string) {
  const asset = new URL(`../../public/screenshots/${name}`, import.meta.url);
  const src = sitePath(`screenshots/${name}`);

  return {
    title,
    body,
    ...(alt ? { alt } : {}),
    ...(existsSync(asset) ? { src } : {}),
  };
}

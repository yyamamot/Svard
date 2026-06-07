export function reorderByIndex<T>(
  items: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const next = [...items];
  const [entry] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, entry);
  return next;
}

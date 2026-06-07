let fallbackRequestIdCounter = 0;

export function createRenderRequestId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  fallbackRequestIdCounter += 1;
  return `${prefix}-${fallbackRequestIdCounter}`;
}

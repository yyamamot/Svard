export function perfTraceEnabled(): boolean {
  const getItem = globalThis.localStorage?.getItem;
  if (
    typeof getItem === "function" &&
    getItem.call(globalThis.localStorage, "SVARD_PERF_TRACE") === "1"
  ) {
    return true;
  }
  return import.meta.env.VITE_SVARD_PERF_TRACE === "1";
}

export function perfNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function perfDuration(startedAt: number): number {
  return Number((perfNow() - startedAt).toFixed(2));
}

export function perfBasename(path: string | null | undefined): string {
  if (!path) {
    return "unknown";
  }
  const normalized = path.replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]/);
  return parts.at(-1) || normalized;
}

export function tracePerf(
  event: string,
  payload: Record<string, unknown> = {},
): void {
  if (!perfTraceEnabled()) {
    return;
  }
  const message = {
    event,
    ...payload,
  };
  console.info("[perf]", message);
  if (!("__TAURI_INTERNALS__" in globalThis)) {
    return;
  }
  void import("@tauri-apps/api/core")
    .then(({ invoke }) =>
      invoke("frontend_perf_log", {
        event,
        fields: stringifyPerfPayload(payload),
      }),
    )
    .catch(() => {});
}

function stringifyPerfPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      stringifyPerfValue(value),
    ]),
  );
}

function stringifyPerfValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return String(value);
  }
  if (value === undefined) {
    return "undefined";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

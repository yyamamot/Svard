import { invoke } from "@tauri-apps/api/core";

interface TauriStructuredError {
  code?: unknown;
  message?: unknown;
}

function normalizeTauriError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "string") {
    return new Error(error);
  }
  if (
    typeof error === "object" &&
    error !== null &&
    typeof (error as TauriStructuredError).message === "string"
  ) {
    return new Error((error as { message: string }).message);
  }
  return new Error("Tauri command failed.");
}

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw normalizeTauriError(error);
  }
}

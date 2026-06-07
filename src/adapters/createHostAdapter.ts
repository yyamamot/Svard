import type { HostAdapter } from "../core/types";
import { MockHostAdapter } from "./mockHostAdapter";
import { TauriHostAdapter } from "./tauriHostAdapter";

export function createHostAdapter(): HostAdapter {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    return new TauriHostAdapter();
  }

  return new MockHostAdapter();
}

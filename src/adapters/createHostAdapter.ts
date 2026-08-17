import type { HostAdapter } from "../core/types";
import { MockHostAdapter } from "./mockHostAdapter";
import { TauriHostAdapter } from "./tauriHostAdapter";

export function createHostAdapter(): HostAdapter {
  const forceMockHost =
    import.meta.env.VITE_SVARD_SITE_SCREENSHOT_MOCK_HOST === "1";
  if (
    !forceMockHost &&
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  ) {
    return new TauriHostAdapter();
  }

  return new MockHostAdapter();
}

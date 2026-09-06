import { describe, expect, it } from "vitest";
import { settingsLabel, getUiCommandTitle } from "../../src/ui/lib/appLabels";
import { getCommandTitle } from "../../src/core/commands";

describe("platform-specific settings labels", () => {
  it.each(["mac", "windows", "linux"] as const)(
    "uses exact labels on %s without renaming command IDs",
    (platform) => {
      const label = platform === "mac" ? "Settings" : "Preferences";
      expect(settingsLabel(platform)).toBe(label);
      expect(getUiCommandTitle("preferences.open", platform)).toBe(
        `Open ${label}`,
      );
      expect(getUiCommandTitle("preferences.close", platform)).toBe(
        `Close ${label}`,
      );
      expect(getUiCommandTitle("app.quit", platform)).toBe(
        getCommandTitle("app.quit"),
      );
      expect(getCommandTitle("preferences.open")).toBe("Open Preferences");
    },
  );
});

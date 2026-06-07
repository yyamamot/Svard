import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tauri security config", () => {
  it("does not expose the home directory through the asset protocol", () => {
    const config = JSON.parse(
      readFileSync(resolve("src-tauri/tauri.conf.json"), "utf8"),
    ) as {
      app?: {
        security?: {
          csp?: string;
          assetProtocol?: { enable?: boolean; scope?: string[] };
        };
      };
    };

    expect(config.app?.security?.assetProtocol?.enable).toBe(false);
    expect(config.app?.security?.assetProtocol?.scope ?? []).not.toContain(
      "$HOME/**",
    );
    expect(config.app?.security?.csp).not.toContain("asset:");
    expect(config.app?.security?.csp).not.toContain("asset.localhost");
  });
});

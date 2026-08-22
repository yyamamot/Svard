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

  it("allows external image loads without widening script or connect sources", () => {
    const config = JSON.parse(
      readFileSync(resolve("src-tauri/tauri.conf.json"), "utf8"),
    ) as {
      app?: { security?: { csp?: string } };
    };
    const directives = new Map(
      (config.app?.security?.csp ?? "")
        .split(";")
        .map((directive) => directive.trim().split(/\s+/u))
        .filter(([name]) => name)
        .map(([name, ...sources]) => [name, sources]),
    );

    expect(directives.get("img-src")).toEqual(
      expect.arrayContaining(["'self'", "data:", "blob:", "https:", "http:"]),
    );
    expect(directives.get("script-src")).not.toEqual(
      expect.arrayContaining(["https:", "http:"]),
    );
    expect(directives.get("connect-src")).not.toEqual(
      expect.arrayContaining(["https:", "http:"]),
    );
  });
});

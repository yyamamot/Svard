import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import { normalizeConfig } from "../../src/ui/lib/config";

interface ConfigSchemaPersistenceContract {
  schemaVersion: 1;
  paths: string[];
}

const contract = JSON.parse(
  fs.readFileSync("docs/contracts/config-schema-persistence.json", "utf8"),
) as ConfigSchemaPersistenceContract;

describe("config schema persistence contract", () => {
  it("keeps frontend default and normalized config aligned with persistence paths", () => {
    const normalizedConfig = normalizeConfig(structuredClone(defaultConfig));

    for (const path of contract.paths) {
      expect(hasPath(defaultConfig, path), `defaultConfig.${path}`).toBe(true);
      expect(hasPath(normalizedConfig, path), `normalizeConfig.${path}`).toBe(
        true,
      );
    }
  });

  it("keeps the contract focused on key paths, not private values", () => {
    const serialized = JSON.stringify(contract);

    expect(serialized).not.toContain("/Users/");
    expect(serialized).not.toContain("fileContent");
    expect(serialized).not.toContain("diagramSource");
    expect(serialized).not.toContain("token:");
  });
});

function hasPath(value: unknown, path: string): boolean {
  return path.split(".").every((segment) => {
    if (!value || typeof value !== "object" || !(segment in value)) {
      return false;
    }
    value = (value as Record<string, unknown>)[segment];
    return true;
  });
}

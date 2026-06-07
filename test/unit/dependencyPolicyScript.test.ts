import { describe, expect, it } from "vitest";

import {
  checkDependencyPolicy,
  sanitizeDependencyReport,
} from "../../scripts/check-dependencies.mjs";

function packageFixture(overrides: Record<string, unknown> = {}) {
  return {
    engines: { node: ">=24.0.0 <25" },
    devDependencies: { "@types/node": "24.12.4" },
    ...overrides,
  };
}

function cargoFixture(body = "") {
  return `
[dependencies]
notify = "8"
reqwest = { version = "0.12", default-features = false }
sha2 = "0.10"

[target.'cfg(target_os = "macos")'.dependencies]
keyring = { version = "3.6.3", features = ["apple-native"] }

${body}
`;
}

function workflowFixture(version = "24") {
  return [
    {
      name: "build.yml",
      content: `
steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${version}
`,
    },
  ];
}

function check(
  overrides: {
    packageJson?: Record<string, unknown>;
    cargoToml?: string;
    workflowVersion?: string;
  } = {},
) {
  return checkDependencyPolicy({
    packageJson: overrides.packageJson ?? packageFixture(),
    cargoToml: overrides.cargoToml ?? cargoFixture(),
    workflows: workflowFixture(overrides.workflowVersion ?? "24"),
  });
}

describe("dependency policy script", () => {
  it("passes the Node 24 and Rust hold baseline", () => {
    const result = check();

    expect(result.passed).toBe(true);
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "engines.node",
          current: ">=24.0.0 <25",
          status: "ok",
        }),
        expect.objectContaining({
          name: "@types/node",
          current: "24.12.4",
          status: "ok",
        }),
        expect.objectContaining({
          name: "ci.setup-node:build.yml",
          current: "24",
          status: "ok",
        }),
      ]),
    );
  });

  it("fails when @types/node moves to the Node 25 major", () => {
    const result = check({
      packageJson: packageFixture({
        devDependencies: { "@types/node": "25.9.1" },
      }),
    });

    expect(result.passed).toBe(false);
    expect(result.results).toContainEqual(
      expect.objectContaining({
        name: "@types/node",
        status: "fail",
      }),
    );
  });

  it("fails when CI moves setup-node away from Node 24", () => {
    const result = check({ workflowVersion: "25" });

    expect(result.passed).toBe(false);
    expect(result.results).toContainEqual(
      expect.objectContaining({
        name: "ci.setup-node:build.yml",
        current: "25",
        status: "fail",
      }),
    );
  });

  it("fails for notify prerelease and keyring 4 candidates", () => {
    const notifyResult = check({
      cargoToml: cargoFixture('notify = "9.0.0-rc.4"'),
    });
    const keyringResult = check({
      cargoToml: `
[dependencies]
notify = "8"

[target.'cfg(target_os = "macos")'.dependencies]
keyring = { version = "4.0.1", features = ["apple-native"] }
`,
    });

    expect(notifyResult.passed).toBe(false);
    expect(notifyResult.results).toContainEqual(
      expect.objectContaining({ name: "notify", status: "fail" }),
    );
    expect(keyringResult.passed).toBe(false);
    expect(keyringResult.results).toContainEqual(
      expect.objectContaining({ name: "keyring", status: "fail" }),
    );
  });

  it("keeps the serialized report free of private paths and lockfile body", () => {
    const report = sanitizeDependencyReport({
      ...check(),
      generatedAt: "2026-05-23T00:00:00.000Z",
    });
    const serialized = JSON.stringify(report);

    expect(report).toHaveProperty("results");
    expect(serialized).not.toContain("/Users/");
    expect(serialized).not.toContain("pnpm-lock.yaml");
    expect(serialized).not.toContain("Cargo.lock");
    expect(serialized).not.toContain("registryResponse");
  });
});

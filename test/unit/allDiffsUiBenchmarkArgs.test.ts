import { describe, expect, it } from "vitest";
import {
  assertAllDiffsUiBenchmarkRuntime,
  parseAllDiffsUiBenchmarkArgs,
} from "../../scripts/all-diffs-ui-benchmark.mjs";

describe("All Diffs UI benchmark arguments", () => {
  it("supports explicit formal and confirmation artifacts", () => {
    expect(
      parseAllDiffsUiBenchmarkArgs([
        "--fixture",
        "branch-markdown-14x12-mixed",
        "--out",
        ".artifacts/formal.json",
        "--port",
        "4301",
      ]),
    ).toMatchObject({
      confirmation: null,
      fixtures: ["branch-markdown-14x12-mixed"],
      out: ".artifacts/formal.json",
      port: 4301,
    });
    expect(
      parseAllDiffsUiBenchmarkArgs([
        "--confirmation",
        ".artifacts/formal.json",
        "--out",
        ".artifacts/confirmation.json",
      ]),
    ).toMatchObject({
      confirmation: ".artifacts/formal.json",
      fixtures: [],
      out: ".artifacts/confirmation.json",
    });
  });

  it("rejects unknown arguments and invalid ports", () => {
    expect(() => parseAllDiffsUiBenchmarkArgs(["--unknown"])).toThrow(
      /Unknown argument/,
    );
    expect(() => parseAllDiffsUiBenchmarkArgs(["--port", "0"])).toThrow(
      /Invalid port/,
    );
  });

  it("accepts only the fixed production bundle runtime", () => {
    expect(assertAllDiffsUiBenchmarkRuntime("vite-production-bundle")).toBe(
      "vite-production-bundle",
    );
    expect(() =>
      assertAllDiffsUiBenchmarkRuntime("development-runtime"),
    ).toThrow(/requires vite-production-bundle/);
  });
});

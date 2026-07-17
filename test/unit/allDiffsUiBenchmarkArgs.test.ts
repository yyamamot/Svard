import { describe, expect, it } from "vitest";
import { parseAllDiffsUiBenchmarkArgs } from "../../scripts/all-diffs-ui-benchmark.mjs";

describe("All Diffs UI benchmark arguments", () => {
  it("supports explicit formal and confirmation artifacts", () => {
    expect(
      parseAllDiffsUiBenchmarkArgs([
        "--out",
        ".artifacts/formal.json",
        "--port",
        "4301",
      ]),
    ).toMatchObject({
      confirmation: null,
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
});

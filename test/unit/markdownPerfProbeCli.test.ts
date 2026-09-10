import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readDocuments: vi.fn(),
  startServer: vi.fn(),
  stop: vi.fn(),
  runProbe: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock(
  "../../scripts/markdown-perf/documents.mjs",
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    readDocuments: mocks.readDocuments,
  }),
);
vi.mock("../../scripts/markdown-perf/server.mjs", () => ({
  startServer: mocks.startServer,
}));
vi.mock("../../scripts/markdown-perf/phases.mjs", () => ({
  runProbe: mocks.runProbe,
}));
vi.mock("node:fs/promises", () => ({
  default: { mkdir: mocks.mkdir, writeFile: mocks.writeFile },
}));

const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const documents = [{ basename: "sample.md", bytes: 1, source: "x" }];
const reportData = { diagnosticSequence: [], phases: [], summary: {} };

async function runCli(args: string[]) {
  process.argv = ["node", "scripts/markdown-perf-probe.mjs", ...args];
  // @ts-expect-error Node CLI module has no TypeScript declaration.
  await import("../../scripts/markdown-perf-probe.mjs");
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.exitCode = 0;
  mocks.readDocuments.mockResolvedValue(documents);
  mocks.startServer.mockResolvedValue({
    url: "http://localhost:4292/",
    stop: mocks.stop,
  });
  mocks.runProbe.mockResolvedValue(reportData);
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.writeFile.mockResolvedValue(undefined);
});

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe("markdown perf probe CLI wiring", () => {
  it("keeps the default diagnostic report non-gating and stops its server", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await runCli([]);
    expect(mocks.readDocuments).toHaveBeenCalledWith([], false);
    expect(mocks.startServer).toHaveBeenCalledWith(4292);
    expect(mocks.runProbe).toHaveBeenCalledWith({
      diagnostic: false,
      documents,
      url: "http://localhost:4292/",
    });
    const report = JSON.parse(String(stdout.mock.calls[0][0]));
    expect(report).toEqual({
      diagnostic: false,
      schemaVersion: 2,
      generatedAt: expect.any(String),
      placeholderMeasurements: [],
      ...reportData,
    });
    expect(process.exitCode).toBe(0);
    expect(mocks.stop).toHaveBeenCalledOnce();
  });

  it("preserves explicit URL, document, diagnostic and output arguments", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await runCli([
      "--url",
      "http://localhost:5000/",
      "--diagnostic",
      "--out",
      ".artifacts/probe.json",
      "--",
      "sample.md",
    ]);
    expect(mocks.readDocuments).toHaveBeenCalledWith(["sample.md"], false);
    expect(mocks.startServer).not.toHaveBeenCalled();
    expect(mocks.runProbe).toHaveBeenCalledWith({
      diagnostic: true,
      documents,
      url: "http://localhost:5000/",
    });
    expect(mocks.mkdir).toHaveBeenCalledWith(path.resolve(".artifacts"), {
      recursive: true,
    });
    expect(mocks.writeFile).toHaveBeenCalledWith(
      ".artifacts/probe.json",
      stdout.mock.calls[0][0],
    );
    expect(mocks.stop).not.toHaveBeenCalled();
  });

  it("makes a missing budget fail only when requested", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await runCli(["--budget", "--port", "4300"]);
    expect(mocks.readDocuments).toHaveBeenCalledWith([], true);
    expect(mocks.startServer).toHaveBeenCalledWith(4300);
    expect(JSON.parse(String(stdout.mock.calls[0][0]))).toMatchObject({
      budgetPassed: false,
      budgetResults: expect.any(Array),
    });
    expect(process.exitCode).toBe(1);
    expect(mocks.stop).toHaveBeenCalledOnce();
  });

  it("propagates probe failures while stopping the owned server", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const failure = new Error("probe failed");
    mocks.runProbe.mockRejectedValueOnce(failure);
    await expect(runCli([])).rejects.toBe(failure);
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(stdout).not.toHaveBeenCalled();
  });

  it("propagates artifact failures while stopping the owned server", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const failure = new Error("write failed");
    mocks.writeFile.mockRejectedValueOnce(failure);
    await expect(runCli(["--out", "report.json"])).rejects.toBe(failure);
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(stdout).not.toHaveBeenCalled();
  });
});

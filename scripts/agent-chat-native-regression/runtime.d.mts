import type { NativeRegressionReport } from "./contract.mjs";

export interface NativeRunState {
  schemaVersion: 1;
  runId: string;
  marker: string;
  repoRoot: string;
  tempRoot: string;
  workspaceA: string;
  workspaceB: string;
  outsideSentinel: string;
}

export interface NativeProcess {
  pid: number;
  ppid: number;
  command: string;
}

export function prepareSyntheticNativeRun(
  repoRoot: string,
  runId: string,
): Promise<NativeRunState>;

export function readNativeRunState(runId: string): Promise<NativeRunState>;
export function readNativeRegressionReport(
  repoRoot: string,
  runId: string,
): Promise<NativeRegressionReport>;
export function writeNativeRegressionReport(
  repoRoot: string,
  report: NativeRegressionReport,
): Promise<void>;
export function parseProcessTable(output: string): NativeProcess[];
export function selectOwnedProviderProcess(
  processes: NativeProcess[],
  svardPid: number,
): NativeProcess;
export function readMacosProcessTable(): Promise<NativeProcess[]>;
export function killOwnedProviderProcess(svardPid: number): Promise<void>;
export function verifyProviderCleanup(svardPid: number): Promise<boolean>;
export function cleanupSyntheticNativeRun(runId: string): Promise<void>;
export function nativeReportPath(repoRoot: string, runId: string): string;

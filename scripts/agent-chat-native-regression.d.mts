import type {
  NativeFailureClass,
  NativeScenarioId,
} from "./agent-chat-native-regression/contract.mjs";

export type NativeRegressionArgs =
  | { command: "prepare"; run: string | null }
  | {
      command: "record";
      run: string;
      scenario: NativeScenarioId;
      status: string;
      failureClass?: NativeFailureClass;
      failedAssertion?: string;
      codexVersion?: string;
      model?: string;
      reasoningEffort?: string;
    }
  | {
      command: "kill-provider" | "finalize";
      run: string;
      svardPid: number;
    };

export function parseNativeRegressionArgs(argv: string[]): NativeRegressionArgs;
export function nativeRunId(date?: Date): string;
export function assertNativeRegressionEnvironment(input?: {
  nodeVersion?: string;
  platform?: string;
}): void;
export function runNativeRegressionCli(
  argv: string[],
  repoRoot?: string,
): Promise<Record<string, string>>;

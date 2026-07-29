import type {
  AgentContextProfile,
  AgentPermissionMode,
  AgentProviderRuntimeSnapshot,
  AppConfig,
} from "../../core/types";

export interface AgentSessionAccessTransactionInput {
  nextMode: AgentPermissionMode;
  nextNetworkAccess?: boolean;
  nextWebSearch?: boolean;
  nextContextProfile?: AgentContextProfile;
  preserveComposerContext?: boolean;
}

type StartSessionTransaction = (
  input: AgentSessionAccessTransactionInput,
) => Promise<boolean>;

export function effectiveContextProfile(
  codex: AppConfig["agentProviders"]["codex"],
  runtime: AgentProviderRuntimeSnapshot | null,
): AgentContextProfile {
  return runtime?.probe.capabilities.focusedContext === true
    ? codex.contextProfile
    : "providerDefaults";
}

export function createAgentContextProfileSelector({
  permissionMode,
  runtime,
  sessionOpen,
  setContextProfile,
  startSessionTransaction,
}: {
  permissionMode: AgentPermissionMode;
  runtime: AgentProviderRuntimeSnapshot | null;
  sessionOpen: () => boolean;
  setContextProfile: (profile: AgentContextProfile) => void;
  startSessionTransaction: StartSessionTransaction;
}) {
  return async (nextContextProfile: AgentContextProfile) => {
    if (
      nextContextProfile === "focused" &&
      runtime?.probe.capabilities.focusedContext !== true
    ) {
      return;
    }
    if (!sessionOpen()) {
      setContextProfile(nextContextProfile);
      return;
    }
    await startSessionTransaction({
      nextMode: permissionMode,
      nextContextProfile,
      preserveComposerContext: true,
    });
  };
}

export function createAgentAccessSelectors({
  permissionMode,
  requestFullAccessConfirmation,
  sessionOpen,
  setNetworkAccess,
  setPermissionMode,
  setWebSearch,
  startSessionTransaction,
}: {
  permissionMode: AgentPermissionMode;
  requestFullAccessConfirmation: (transaction: () => Promise<boolean>) => void;
  sessionOpen: () => boolean;
  setNetworkAccess: (enabled: boolean) => void;
  setPermissionMode: (mode: AgentPermissionMode) => void;
  setWebSearch: (enabled: boolean) => void;
  startSessionTransaction: StartSessionTransaction;
}) {
  return {
    selectPermissionMode: async (nextMode: AgentPermissionMode) => {
      if (!sessionOpen()) {
        setPermissionMode(nextMode);
        return;
      }
      const transaction = () =>
        startSessionTransaction({
          nextMode,
          preserveComposerContext: true,
        });
      if (nextMode === "fullAccess") {
        requestFullAccessConfirmation(transaction);
        return;
      }
      await transaction();
    },
    selectNetworkAccess: async (nextNetworkAccess: boolean) => {
      if (!sessionOpen()) {
        setNetworkAccess(nextNetworkAccess);
        return;
      }
      await startSessionTransaction({
        nextMode: permissionMode,
        nextNetworkAccess,
        preserveComposerContext: true,
      });
    },
    selectWebSearch: async (nextWebSearch: boolean) => {
      if (!sessionOpen()) {
        setWebSearch(nextWebSearch);
        return;
      }
      await startSessionTransaction({
        nextMode: permissionMode,
        nextWebSearch,
        preserveComposerContext: true,
      });
    },
  };
}

export function createRestartSessionFromProviderDefaults({
  clearIdleSession,
  codexDefaults,
  contextProfile,
  requestFullAccessConfirmation,
  sessionOpen,
  startSessionTransaction,
}: {
  clearIdleSession: () => void;
  codexDefaults: AppConfig["agentProviders"]["codex"];
  contextProfile: AgentContextProfile;
  requestFullAccessConfirmation: (transaction: () => Promise<boolean>) => void;
  sessionOpen: () => boolean;
  startSessionTransaction: StartSessionTransaction;
}) {
  return async () => {
    if (!sessionOpen()) {
      clearIdleSession();
      return;
    }
    const input = {
      nextMode: codexDefaults.permissionMode,
      nextNetworkAccess: codexDefaults.networkAccess,
      nextWebSearch: codexDefaults.webSearch,
      nextContextProfile: contextProfile,
    };
    if (codexDefaults.permissionMode === "fullAccess") {
      requestFullAccessConfirmation(() => startSessionTransaction(input));
      return;
    }
    await startSessionTransaction(input);
  };
}

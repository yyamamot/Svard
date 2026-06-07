import type {
  HostAdapter,
  ProviderTokenStatus,
  RemoteProviderTestStatus,
} from "../../core/types";

type Provider = "github" | "gitlab";

export type MockProviderTokenFacade = Pick<
  HostAdapter,
  | "saveProviderToken"
  | "deleteProviderToken"
  | "getProviderTokenStatus"
  | "testProviderConnection"
>;

const providerTokens = new Map<string, string>();

function providerTokenKey(provider: Provider, hostUrl: string) {
  return `${provider}:${hostUrl.trim().replace(/\/$/, "")}`;
}

export function createMockProviderTokenFacade(): MockProviderTokenFacade {
  return {
    saveProviderToken,
    deleteProviderToken,
    getProviderTokenStatus,
    testProviderConnection,
  };
}

async function saveProviderToken(
  provider: Provider,
  hostUrl: string,
  token: string,
): Promise<ProviderTokenStatus> {
  if (!token.trim()) {
    throw new Error("Provider token cannot be empty.");
  }
  providerTokens.set(providerTokenKey(provider, hostUrl), token.trim());
  return { stored: true, message: "Token stored in OS credential store." };
}

async function deleteProviderToken(
  provider: Provider,
  hostUrl: string,
): Promise<ProviderTokenStatus> {
  providerTokens.delete(providerTokenKey(provider, hostUrl));
  return {
    stored: false,
    message: "Token removed from OS credential store.",
  };
}

async function getProviderTokenStatus(
  provider: Provider,
  hostUrl: string,
): Promise<ProviderTokenStatus> {
  return { stored: providerTokens.has(providerTokenKey(provider, hostUrl)) };
}

async function testProviderConnection(
  provider: Provider,
  hostUrl: string,
): Promise<RemoteProviderTestStatus> {
  return providerTokens.has(providerTokenKey(provider, hostUrl))
    ? { status: "ok", message: "Connection test succeeded." }
    : { status: "error", message: "Token is not configured." };
}

import {
  reopenAgentContextForCapture,
  runAgentContextPressureScenario,
} from "./agentChatContextPressure.mjs";
import {
  exerciseAgentContextProfilePlacements,
  prepareAgentContextProfileScenario,
  reopenAgentContextProfileForCapture,
} from "./agentChatContextProfile.mjs";
import {
  reopenAgentTokenDiagnosticsForCapture,
  runAgentTokenDiagnosticsScenario,
} from "./agentChatTokenDiagnostics.mjs";

export const agentChatContextScenarios = {
  pressure: {
    reopen: reopenAgentContextForCapture,
    run: runAgentContextPressureScenario,
  },
  profile: {
    prepare: prepareAgentContextProfileScenario,
    reopen: reopenAgentContextProfileForCapture,
    run: exerciseAgentContextProfilePlacements,
  },
  tokenDiagnostics: {
    reopen: reopenAgentTokenDiagnosticsForCapture,
    run: runAgentTokenDiagnosticsScenario,
  },
};

import { createContext } from "react";
import type { AgentImageAttachment } from "../../core/types";

export interface SvardOpenUiRuntime {
  disabled?: boolean;
  readOnly?: boolean;
  images?: AgentImageAttachment[];
  onAgentAction?: (message: string) => void;
  onOpenExternalLink?: (url: string) => void;
  onOpenFile?: (relativePath: string) => void;
  resolveWorkspaceImage?: (relativePath: string) => Promise<string | null>;
}

export const SvardOpenUiRuntimeContext = createContext<SvardOpenUiRuntime>({});

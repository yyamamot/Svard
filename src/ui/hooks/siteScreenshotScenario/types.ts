import type { Dispatch, SetStateAction } from "react";

import type { AppConfig, DocumentPayload } from "../../../core/types";
import type { RightSidebarTab, SearchScope } from "../../types";

export interface UseSiteScreenshotScenarioOptions {
  closeAllTabs: () => void;
  dismissInlineNotice: () => void;
  documentPayload: DocumentPayload | null;
  openDirectory: (path: string) => Promise<void> | void;
  openDocument: (path: string) => Promise<void> | void;
  openPreferences: () => void;
  loadDocumentForScreenshot: (path: string) => Promise<DocumentPayload>;
  setConfig: Dispatch<SetStateAction<AppConfig | null>>;
  setDocumentPayload: Dispatch<SetStateAction<DocumentPayload | null>>;
  setRootDirectory: Dispatch<SetStateAction<string>>;
  setSidebarLayout: Dispatch<SetStateAction<AppConfig["layout"]>>;
  setTabs: Dispatch<SetStateAction<DocumentPayload[]>>;
  setZenModeActive: Dispatch<SetStateAction<boolean>>;
  setWindowTheme: (theme: AppConfig["theme"]) => Promise<void> | void;
  setRightSidebarTab: Dispatch<SetStateAction<RightSidebarTab>>;
  setSearchScope: (scope: SearchScope) => void;
  compareDocumentPaths: (leftPath: string, rightPath: string) => Promise<void>;
  showGitDiff: (path?: string) => Promise<void>;
  updateSearchQuery: (value: string) => void;
}

export interface SiteScreenshotScenarioContext extends UseSiteScreenshotScenarioOptions {
  fixturePath: string;
  scenario: string;
}

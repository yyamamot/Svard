export interface UiReviewScenarioContractEntry {
  id: string;
  group: string;
  handler: string;
  requiredMarkers: string[];
  optionalCoreMarkers: string[];
  documented: boolean;
  usesPreferencesPageShell?: boolean;
  checksPreferencesLayout?: boolean;
}

export interface UiReviewScenarioContract {
  schemaVersion: number;
  scenarios: UiReviewScenarioContractEntry[];
}

export const uiReviewScenarioContract: UiReviewScenarioContract;
export const preferenceScenarioIds: string[];
export const uiReviewScenarioContractIds: string[];

export function scenarioContractFor(
  scenario: string,
): UiReviewScenarioContractEntry | null;

export function preferenceScenarioFor(
  scenario: string,
): UiReviewScenarioContractEntry | null;

export function isPreferencesPageScenario(scenario: string): boolean;

export function isPreferencesLayoutScenario(scenario: string): boolean;

export function optionalCoreMarkersForScenario(scenario: string): string[];

export function requiredMarkersForScenario(scenario: string): string[];

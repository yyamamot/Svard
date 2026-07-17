import { createContext, useContext, useMemo, type ReactNode } from "react";

export type AllDiffsUiPerformanceVariant =
  | "production"
  | "without-margin-markers"
  | "without-rendered-rulers";

export type AllDiffsUiPerformanceEvent =
  | {
      type: "margin-measure";
      durationMs: number;
      rectCount: number;
      targetCount: number;
    }
  | {
      type: "margin-resize-callback";
      callbackCount: number;
      entryCount: number;
    }
  | {
      type: "margin-mutation-callback";
      callbackCount: number;
      mutationCount: number;
    }
  | {
      type: "stream-ruler-measure";
      durationMs: number;
      markerCount: number;
      rectCount: number;
      targetCount: number;
    }
  | {
      type: "stream-ruler-resize-callback";
      callbackCount: number;
      entryCount: number;
    }
  | {
      type: "presentation-rebuild";
      durationMs: number;
      itemCount: number;
      readyItemCount: number;
      targetCount: number;
    }
  | {
      type: "active-file-scroll-sync";
      durationMs: number;
      rectCount: number;
      sectionCount: number;
    };

export interface AllDiffsUiPerformanceMeasurement {
  enabled: boolean;
  marginMarkersEnabled: boolean;
  record: (event: AllDiffsUiPerformanceEvent) => void;
  renderedRulerEnabled: boolean;
  variant: AllDiffsUiPerformanceVariant;
}

const noOpRecord = (_event: AllDiffsUiPerformanceEvent) => undefined;

const disabledMeasurement: AllDiffsUiPerformanceMeasurement = {
  enabled: false,
  marginMarkersEnabled: true,
  record: noOpRecord,
  renderedRulerEnabled: true,
  variant: "production",
};

const AllDiffsUiPerformanceContext =
  createContext<AllDiffsUiPerformanceMeasurement>(disabledMeasurement);

export function AllDiffsUiPerformanceProvider({
  children,
  onEvent,
  variant,
}: {
  children: ReactNode;
  onEvent: (event: AllDiffsUiPerformanceEvent) => void;
  variant: AllDiffsUiPerformanceVariant;
}) {
  const measurement = useMemo<AllDiffsUiPerformanceMeasurement>(
    () => ({
      enabled: true,
      marginMarkersEnabled: variant === "production",
      record: onEvent,
      renderedRulerEnabled: variant !== "without-rendered-rulers",
      variant,
    }),
    [onEvent, variant],
  );
  return (
    <AllDiffsUiPerformanceContext.Provider value={measurement}>
      {children}
    </AllDiffsUiPerformanceContext.Provider>
  );
}

export function useAllDiffsUiPerformance() {
  return useContext(AllDiffsUiPerformanceContext);
}

export function allDiffsUiPerformanceNow() {
  return performance.now();
}

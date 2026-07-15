import type { DocumentFormat } from "../../src/core/types";

export interface DiffRenderPhaseDocumentFixture {
  documentId: string;
  format: DocumentFormat;
  path: string;
  relativePath: string;
  source: string;
}

export interface DiffRenderPhasePairFixture {
  left: DiffRenderPhaseDocumentFixture;
  right: DiffRenderPhaseDocumentFixture;
}

export type DiffRenderPhaseWorkflow =
  | "rendered-summary"
  | "rendered-table"
  | "marker-context"
  | "all-diffs";

export interface DiffRenderPhaseFixture {
  expected: {
    blockParseCount: number;
    blockTextParseCount: number;
    coreRenderCount: number;
    diffOutcomes: readonly string[];
    markerOutcomes: readonly string[];
    prepareCount: number;
    tableOutcomes: readonly string[];
  };
  fixtureId: string;
  format: DocumentFormat;
  workflow: DiffRenderPhaseWorkflow;
  pairs: readonly DiffRenderPhasePairFixture[];
}

export const diffRenderPhaseFixtures: readonly DiffRenderPhaseFixture[];
export const diffRenderPhaseFixtureIds: readonly string[];

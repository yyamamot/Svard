export interface AllDiffsUiFixtureDocument {
  path: string;
  relativePath: string;
  source: string;
}

export interface AllDiffsUiFixture {
  fixtureId: string;
  expectedChangeCount: number;
  pairs: Array<{
    left: AllDiffsUiFixtureDocument;
    right: AllDiffsUiFixtureDocument;
  }>;
}

export const allDiffsUiFixtures: AllDiffsUiFixture[];
export function allDiffsUiFixture(fixtureId: string): AllDiffsUiFixture;

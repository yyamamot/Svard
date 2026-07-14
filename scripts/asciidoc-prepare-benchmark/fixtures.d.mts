export interface AsciiDocPrepareFixture {
  fixtureId:
    | "plain-large"
    | "include-heavy"
    | "diagram-heavy"
    | "assets-duplicate"
    | "assets-unique";
  source: string;
  includeFiles: Array<{ path: string; source: string }>;
}

export const asciidocPrepareFixtures: readonly AsciiDocPrepareFixture[];
export const asciidocPrepareFixtureIds: readonly AsciiDocPrepareFixture["fixtureId"][];

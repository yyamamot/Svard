export interface MainViewerRenderFixture {
  cacheStatus: "not-applicable";
  expectedMediaCount: number;
  fixtureId:
    | "plain-control"
    | "dom-dense"
    | "svg-one"
    | "raster-duplicate"
    | "raster-unique"
    | "raster-near-5-mib";
  mediaKind: "none" | "svg" | "raster";
  sizeBucket: "none" | "under-64-kib" | "64-kib-to-1-mib" | "1-mib-to-5-mib";
  source: string;
}

export const mainViewerRenderFixtures: readonly MainViewerRenderFixture[];
export const mainViewerRenderFixtureIds: readonly MainViewerRenderFixture["fixtureId"][];
export function mainViewerRenderFixture(
  fixtureId: string,
): MainViewerRenderFixture;

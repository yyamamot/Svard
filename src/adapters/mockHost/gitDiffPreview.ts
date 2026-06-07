import type { GitDiffPreview } from "../../core/types";
import { getBasicGitDiffPreview } from "./gitDiffPreview/basicFixtures";
import { getImageDiagramGitDiffPreview } from "./gitDiffPreview/imageDiagramFixtures";
import { getRegressionGalleryGitDiffPreview } from "./gitDiffPreview/regressionGalleryFixtures";
import { getRenderedDocumentGitDiffPreview } from "./gitDiffPreview/renderedDocumentFixtures";
import { getTableGitDiffPreview } from "./gitDiffPreview/tableFixtures";

const gitDiffPreviewFixtureProviders = [
  getTableGitDiffPreview,
  getRenderedDocumentGitDiffPreview,
  getImageDiagramGitDiffPreview,
  getRegressionGalleryGitDiffPreview,
];

export async function getGitDiffPreview(path: string): Promise<GitDiffPreview> {
  const relativePath = path.replace(/^\/workspace\//, "");
  const override = gitDiffPreviewOverride(path);
  if (override) {
    return override;
  }
  for (const getFixture of gitDiffPreviewFixtureProviders) {
    const preview = getFixture(path, relativePath);
    if (preview) {
      return preview;
    }
  }
  return getBasicGitDiffPreview(path, relativePath);
}

function gitDiffPreviewOverride(path: string): GitDiffPreview | null {
  if (typeof window === "undefined") {
    return null;
  }
  const override = (
    window as unknown as {
      __SVARD_GIT_DIFF_OVERRIDES__?: Record<string, GitDiffPreview>;
    }
  ).__SVARD_GIT_DIFF_OVERRIDES__?.[path];
  return override ? structuredClone(override) : null;
}

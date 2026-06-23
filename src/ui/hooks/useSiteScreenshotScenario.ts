import { useEffect, useRef } from "react";

import { inferScreenshotScenario } from "./siteScreenshotScenario/scenarioIds";
import { runSiteScreenshotScenario } from "./siteScreenshotScenario/router";
import type { UseSiteScreenshotScenarioOptions } from "./siteScreenshotScenario/types";

const envScreenshotScenario = import.meta.env
  .VITE_SVARD_SITE_SCREENSHOT_SCENARIO;
const envScreenshotFixture = import.meta.env.VITE_SVARD_SITE_SCREENSHOT_FIXTURE;

export function useSiteScreenshotScenario(
  options: UseSiteScreenshotScenarioOptions,
) {
  const appliedRef = useRef(false);
  const { documentPayload } = options;
  const activePath = documentPayload?.path ?? null;

  useEffect(() => {
    const scenario =
      envScreenshotScenario ||
      inferScreenshotScenario(envScreenshotFixture) ||
      inferScreenshotScenario(activePath);

    if (appliedRef.current || !documentPayload || !scenario) {
      return;
    }

    let disposed = false;
    const initialDocumentPath = documentPayload.path;

    async function applyScenario() {
      appliedRef.current = true;
      const fixturePath =
        envScreenshotFixture || activePath || initialDocumentPath;

      await runSiteScreenshotScenario({
        ...options,
        fixturePath,
        scenario,
      });

      if (disposed) {
        return;
      }
    }

    void applyScenario().catch((error) => {
      console.error("site screenshot scenario failed", error);
    });

    return () => {
      disposed = true;
    };
  }, [activePath, documentPayload, options]);
}

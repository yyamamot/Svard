import { describe, expect, it } from "vitest";
import {
  OPENUI_BASIC_BALANCED_COMPONENTS,
  OPENUI_BASIC_BALANCED_FIXTURE,
  OPENUI_BASIC_GALLERY_FIXTURE,
  OPENUI_BASIC_HOLD_COMPONENTS,
  OPENUI_BASIC_KEEP_COMPONENTS,
  OPENUI_BASIC_LEAN_COMPONENTS,
  OPENUI_BASIC_LEAN_FIXTURE,
  OPENUI_BASIC_LIMIT_DIAGNOSTIC_FIXTURE,
  OPENUI_BASIC_PROFILE_COMPONENTS,
  OPENUI_BASIC_PROFILE_STRUCTURAL_COMPONENTS,
  OPENUI_BASIC_REVIEW_FIXTURE,
  OPENUI_COMPONENT_CHALLENGERS_FIXTURE,
  isOpenUiProfileComparisonQuestion,
  mockOpenUiEvaluationAnswer,
} from "../../src/adapters/mockHost/openUiEvaluationFixtures";
import {
  SVARD_OPENUI_BALANCED_COMPONENTS,
  SVARD_OPENUI_LEAN_COMPONENTS,
  svardOpenUiBalancedLibrary,
  svardOpenUiBalancedPrompt,
  svardOpenUiLeanLibrary,
  svardOpenUiLeanPrompt,
  svardOpenUiLibrary,
  svardOpenUiPrompt,
  validateOpenUiResponse,
} from "../../src/ui/codex/openUiLibrary";

function usedComponents(source: string) {
  return new Set(
    [...source.matchAll(/\b([A-Z][A-Za-z0-9]+)\(/gu)].map((match) => match[1]),
  );
}

describe("OpenUI basic profile evaluation fixtures", () => {
  it("keeps the proposed reader-facing profile at exactly 18 components", () => {
    expect(OPENUI_BASIC_PROFILE_COMPONENTS).toHaveLength(18);
    expect(new Set(OPENUI_BASIC_PROFILE_COMPONENTS).size).toBe(18);
    expect(OPENUI_BASIC_PROFILE_COMPONENTS[0]).toBe("SvardExperience");
    expect(OPENUI_BASIC_PROFILE_STRUCTURAL_COMPONENTS).toEqual(["Col"]);
  });

  it("defines the recommended Keep, Hold, balanced, and lean sets", () => {
    expect(OPENUI_BASIC_KEEP_COMPONENTS).toHaveLength(10);
    expect(OPENUI_BASIC_HOLD_COMPONENTS).toHaveLength(4);
    expect(OPENUI_BASIC_BALANCED_COMPONENTS).toHaveLength(14);
    expect(OPENUI_BASIC_LEAN_COMPONENTS).toEqual(OPENUI_BASIC_KEEP_COMPONENTS);
    expect(new Set(OPENUI_BASIC_BALANCED_COMPONENTS).size).toBe(14);
    expect(new Set(SVARD_OPENUI_BALANCED_COMPONENTS)).toEqual(
      new Set([
        ...OPENUI_BASIC_BALANCED_COMPONENTS.filter(
          (name) => name !== "SvardExperience",
        ),
        "Col",
      ]),
    );
    expect(new Set(SVARD_OPENUI_LEAN_COMPONENTS)).toEqual(
      new Set([
        ...OPENUI_BASIC_LEAN_COMPONENTS.filter(
          (name) => name !== "SvardExperience",
        ),
        "Col",
      ]),
    );
  });

  it("renders the review and gallery fixtures with only the proposed profile", () => {
    const allowed = new Set<string>([
      ...OPENUI_BASIC_PROFILE_COMPONENTS,
      ...OPENUI_BASIC_PROFILE_STRUCTURAL_COMPONENTS,
    ]);

    for (const source of [
      OPENUI_BASIC_REVIEW_FIXTURE,
      OPENUI_BASIC_GALLERY_FIXTURE,
    ]) {
      const parsed = validateOpenUiResponse(source);
      expect(parsed.valid, JSON.stringify(parsed.meta)).toBe(true);
      expect(
        [...usedComponents(source)].every((name) => allowed.has(name)),
      ).toBe(true);
    }

    expect(usedComponents(OPENUI_BASIC_GALLERY_FIXTURE)).toEqual(allowed);
  });

  it("keeps challenger components outside the proposed reader-facing profile", () => {
    const parsed = validateOpenUiResponse(OPENUI_COMPONENT_CHALLENGERS_FIXTURE);
    const proposed = new Set<string>(OPENUI_BASIC_PROFILE_COMPONENTS);
    const used = usedComponents(OPENUI_COMPONENT_CHALLENGERS_FIXTURE);

    expect(parsed.valid, JSON.stringify(parsed.meta)).toBe(true);
    expect(
      [
        "BarChart",
        "Form",
        "Tabs",
        "Accordion",
        "FileMap",
        "ImageGallery",
      ].every((name) => used.has(name) && !proposed.has(name)),
    ).toBe(true);
  });

  it("validates the comparison fixtures against only their scoped profiles", () => {
    const balanced = validateOpenUiResponse(
      OPENUI_BASIC_BALANCED_FIXTURE,
      "balanced",
    );
    const lean = validateOpenUiResponse(OPENUI_BASIC_LEAN_FIXTURE, "lean");
    const balancedAllowed = new Set([
      ...OPENUI_BASIC_BALANCED_COMPONENTS,
      ...OPENUI_BASIC_PROFILE_STRUCTURAL_COMPONENTS,
    ]);
    const leanAllowed = new Set([
      ...OPENUI_BASIC_LEAN_COMPONENTS,
      ...OPENUI_BASIC_PROFILE_STRUCTURAL_COMPONENTS,
    ]);

    expect(balanced.valid, JSON.stringify(balanced.meta)).toBe(true);
    expect(lean.valid, JSON.stringify(lean.meta)).toBe(true);
    expect(usedComponents(OPENUI_BASIC_BALANCED_FIXTURE)).toEqual(
      balancedAllowed,
    );
    expect(usedComponents(OPENUI_BASIC_LEAN_FIXTURE)).toEqual(leanAllowed);
  });

  it("keeps excluded components available only to the full profile", () => {
    const source = [
      'root = SvardExperience("Legacy", "Read-only history", [stat])',
      'stat = StatCard("Coverage", "75%")',
    ].join("\n");

    expect(validateOpenUiResponse(source, "full").valid).toBe(true);
    expect(validateOpenUiResponse(source, "balanced")).toMatchObject({
      valid: false,
      reason: "unsupportedComponent",
    });
    expect(validateOpenUiResponse(source, "lean")).toMatchObject({
      valid: false,
      reason: "unsupportedComponent",
    });
  });

  it("keeps scoped prompts below the size gate without leaking excluded components", () => {
    const metrics = {
      full: {
        bytes: Buffer.byteLength(svardOpenUiPrompt, "utf8"),
        components: Object.keys(svardOpenUiLibrary.components).length,
        lines: svardOpenUiPrompt.split("\n").length,
      },
      balanced: {
        bytes: Buffer.byteLength(svardOpenUiBalancedPrompt, "utf8"),
        components: Object.keys(svardOpenUiBalancedLibrary.components).length,
        lines: svardOpenUiBalancedPrompt.split("\n").length,
      },
      lean: {
        bytes: Buffer.byteLength(svardOpenUiLeanPrompt, "utf8"),
        components: Object.keys(svardOpenUiLeanLibrary.components).length,
        lines: svardOpenUiLeanPrompt.split("\n").length,
      },
    };
    const fullNames = Object.keys(svardOpenUiLibrary.components);

    expect(metrics).toEqual({
      full: { bytes: 21_295, components: 74, lines: 188 },
      balanced: { bytes: 8_959, components: 15, lines: 110 },
      lean: { bytes: 8_206, components: 11, lines: 105 },
    });
    expect(metrics.balanced.bytes).toBeLessThanOrEqual(10_000);
    expect(metrics.lean.bytes).toBeLessThanOrEqual(10_000);
    expect(metrics.balanced.bytes).toBeLessThanOrEqual(
      metrics.full.bytes * 0.5,
    );
    expect(metrics.lean.bytes).toBeLessThanOrEqual(metrics.full.bytes * 0.5);

    for (const [prompt, allowed] of [
      [
        svardOpenUiBalancedPrompt,
        new Set(["SvardExperience", ...SVARD_OPENUI_BALANCED_COMPONENTS]),
      ],
      [
        svardOpenUiLeanPrompt,
        new Set(["SvardExperience", ...SVARD_OPENUI_LEAN_COMPONENTS]),
      ],
    ] as const) {
      expect(
        fullNames
          .filter((name) => !allowed.has(name))
          .every(
            (name) =>
              !new RegExp(
                `(?:^|\\n)${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\(`,
                "u",
              ).test(prompt),
          ),
      ).toBe(true);
    }
  });

  it("selects evaluation answers without changing generic Visualize responses", () => {
    expect(
      mockOpenUiEvaluationAnswer("Show the OpenUI basic profile review."),
    ).toBe(OPENUI_BASIC_REVIEW_FIXTURE);
    expect(
      mockOpenUiEvaluationAnswer("Show the OpenUI basic profile gallery."),
    ).toBe(OPENUI_BASIC_GALLERY_FIXTURE);
    expect(
      mockOpenUiEvaluationAnswer("Show the OpenUI component challengers."),
    ).toBe(OPENUI_COMPONENT_CHALLENGERS_FIXTURE);
    expect(
      mockOpenUiEvaluationAnswer(
        "Show the OpenUI balanced profile comparison.",
      ),
    ).toBe(OPENUI_BASIC_BALANCED_FIXTURE);
    expect(
      mockOpenUiEvaluationAnswer("Show the OpenUI lean profile comparison."),
    ).toBe(OPENUI_BASIC_LEAN_FIXTURE);
    expect(
      mockOpenUiEvaluationAnswer("Show the OpenUI balanced limit diagnostic."),
    ).toBe(OPENUI_BASIC_LIMIT_DIAGNOSTIC_FIXTURE);
    expect(
      validateOpenUiResponse(OPENUI_BASIC_LIMIT_DIAGNOSTIC_FIXTURE, "balanced"),
    ).toMatchObject({
      valid: false,
      reason: "complexityLimit",
      limitDiagnostic: {
        metric: "tableRows",
        actual: 101,
        limit: 100,
      },
    });
    expect(
      isOpenUiProfileComparisonQuestion(
        "Show the OpenUI balanced profile comparison.",
      ),
    ).toBe(true);
    expect(isOpenUiProfileComparisonQuestion("Show the OpenUI gallery.")).toBe(
      false,
    );
    expect(
      mockOpenUiEvaluationAnswer("Visualize the workspace boundaries."),
    ).toBe(null);
  });
});

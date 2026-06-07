import { describe, expect, it } from "vitest";

import {
  checkImplementationPlanConsistency,
  extractCompletedImpIds,
} from "../../scripts/check-implementation-plan-consistency.mjs";

function plan(body: string) {
  return `# 実装計画

## Active

現在の active task はなし。

## Backlog

${body}

## Draft / Later

### IMP-044: Antora
`;
}

function history(done: string) {
  return `# 実装履歴

## Done

${done}
`;
}

describe("implementation plan consistency", () => {
  it("passes when completed IMPs are absent from active and backlog", () => {
    const result = checkImplementationPlanConsistency({
      planMarkdown: plan("### IMP-067: Next task"),
      historyMarkdown: history("### IMP-061: Completed task"),
    });

    expect(result.passed).toBe(true);
  });

  it("checks completed IMPs across split history markdowns", () => {
    const result = checkImplementationPlanConsistency({
      planMarkdown: plan("### IMP-061: Completed task still listed"),
      historyMarkdowns: [
        history("### IMP-060: Older completed task"),
        history("### IMP-061: Completed task"),
      ],
    });

    expect(result).toEqual({
      passed: false,
      messages: ["completed IMP remains in active/backlog: IMP-061"],
    });
  });

  it("fails when a completed IMP remains as a backlog heading", () => {
    const result = checkImplementationPlanConsistency({
      planMarkdown: plan("### IMP-061: Completed task still listed"),
      historyMarkdown: history("### IMP-061: Completed task"),
    });

    expect(result).toEqual({
      passed: false,
      messages: ["completed IMP remains in active/backlog: IMP-061"],
    });
  });

  it("fails when a completed IMP remains only in the recommendation line", () => {
    const result = checkImplementationPlanConsistency({
      planMarkdown: plan(
        "次の推奨順は `IMP-061 -> IMP-067`。\n\n### IMP-067: Next task",
      ),
      historyMarkdown: history("### IMP-061: Completed task"),
    });

    expect(result.passed).toBe(false);
    expect(result.messages).toContain(
      "completed IMP remains in active/backlog: IMP-061",
    );
  });

  it("ignores completed IMPs in Draft / Later", () => {
    const result = checkImplementationPlanConsistency({
      planMarkdown: `# 実装計画

## Active

なし。

## Backlog

### IMP-067: Next task

## Draft / Later

### IMP-061: Completed future reference
`,
      historyMarkdown: history("### IMP-061: Completed task"),
    });

    expect(result.passed).toBe(true);
  });

  it("treats suffix IMP ids as distinct ids", () => {
    expect(
      extractCompletedImpIds(
        history(`### IMP-065-followup: Performance attribution

### IMP-065: PlantUML concurrency`),
      ),
    ).toEqual(["IMP-065", "IMP-065-followup"]);

    const result = checkImplementationPlanConsistency({
      planMarkdown: plan("### IMP-065: Base task reference"),
      historyMarkdown: history("### IMP-065-followup: Performance attribution"),
    });

    expect(result.passed).toBe(true);
  });
});

export type AgentChatDisplayTarget = "right" | "bottom" | "diff" | "detached";

export type AgentChatDisplayAction =
  | "showRight"
  | "showBottom"
  | "showDiff"
  | "openDetached"
  | "focusDetached"
  | "attachMain"
  | "hide";

export interface AgentChatDisplayMenuItem {
  action: AgentChatDisplayAction;
  checked?: boolean;
  disabled?: boolean;
  label: string;
}

export function buildAgentChatDisplayMenu({
  detached,
  diffOpen,
  mainOpen,
  mainPlacement,
  moving,
  snapshotAvailable,
}: {
  detached: boolean;
  diffOpen: boolean;
  mainOpen: boolean;
  mainPlacement: "right" | "bottom";
  moving: boolean;
  snapshotAvailable: boolean;
}): AgentChatDisplayMenuItem[] {
  if (detached) {
    return [
      {
        action: "focusDetached",
        checked: true,
        disabled: moving,
        label: "Focus separate window",
      },
      {
        action: "attachMain",
        disabled: moving,
        label: "Attach to Main",
      },
    ];
  }

  const items: AgentChatDisplayMenuItem[] = diffOpen
    ? [
        {
          action: "showDiff",
          checked: mainOpen,
          disabled: moving,
          label: "Diff Preview",
        },
        {
          action: "openDetached",
          checked: false,
          disabled: moving || !snapshotAvailable,
          label: "Separate window",
        },
      ]
    : [
        {
          action: "showRight",
          checked: mainOpen && mainPlacement === "right",
          disabled: moving,
          label: "Right side",
        },
        {
          action: "showBottom",
          checked: mainOpen && mainPlacement === "bottom",
          disabled: moving,
          label: "Bottom",
        },
        {
          action: "openDetached",
          checked: false,
          disabled: moving || !snapshotAvailable,
          label: "Separate window",
        },
      ];

  if (mainOpen) {
    items.push({
      action: "hide",
      disabled: moving,
      label: "Hide AI Chat",
    });
  }
  return items;
}

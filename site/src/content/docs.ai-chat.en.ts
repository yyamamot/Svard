import { screenshot } from "./screenshots";

export const aiChatDocsEn = {
  aiChat: {
    title: "Get started with AI Chat",
    lead: "AI Chat is an Experimental feature for asking Codex questions while reading documents in the same workspace.",
    whatThisFeatureIs:
      "Svard launches a locally installed Codex as its first supported provider and shows Markdown answers or interactive Visualize output in AI Chat. Opening the panel does not start a conversation; a new chat starts when you send the first question.",
    whenToUse:
      "Use it to clarify a specification or procedure, keep review questions beside the document, or identify checks to perform after a change.",
    workflow: [
      {
        title: "Prepare Codex",
        body: "Open AI Providers in Preferences to check Codex detection, the model, reasoning effort, and personality. Claude Code CLI and GitHub Copilot CLI are not currently supported.",
        screenshot: screenshot(
          "ai-chat-provider-settings.png",
          "Codex settings in AI Providers",
          "Shows the Codex readiness and model settings used by AI Chat.",
          "Svard AI Providers showing Codex settings",
        ),
      },
      {
        title: "Choose a display target",
        body: "Use AI Chat in the top bar to choose Right side, Bottom, or Separate window. Diff Preview is also available while reviewing a diff.",
      },
      {
        title: "Send a question",
        body: "Use Auto for a normal Markdown answer and Visualize when an interactive result is useful. Svard does not create a Codex session until you send the question.",
        screenshot: screenshot(
          "ai-chat-main.png",
          "Document and AI Chat",
          "Shows a public document beside a completed right-side AI Chat answer.",
          "Svard desktop app showing a document and right-side AI Chat",
        ),
      },
    ],
    limitations:
      "AI Chat is Experimental. Codex is the first supported provider and requires a compatible installation and authentication. Document reading and local diagram rendering continue to use local paths when AI Chat is not used.",
    related: [
      "AI Chat context and Agent Access",
      "AI Chat conversations and change review",
      "Local-first model",
    ],
  },
  aiChatContextAccess: {
    title: "AI Chat context and Agent Access",
    lead: "Add only the document information a question needs and choose the operations Codex may perform for the chat.",
    whatThisFeatureIs:
      "The current document contributes only its workspace-relative path when a turn is sent. Document text, selections, images, diagrams, and the current Rendered Diff change become turn context only when you add them explicitly.",
    whenToUse:
      "Use it when an answer needs a specific paragraph, diagram, or before-and-after change, or when you need to choose between read-only access and workspace changes.",
    supportMatrix: {
      title: "Agent Access",
      lead: "Permission, Network, and Web Search are available only when the selected provider supports them.",
      columns: ["Setting", "Allowed scope", "Typical use"],
      rows: [
        [
          "Observe",
          "Read-only with Network disabled.",
          "Understanding and review",
        ],
        [
          "Agent",
          "Changes inside the explicit workspace; operations outside the boundary require approval.",
          "Guided edits",
        ],
        [
          "Full Access",
          "Broader access that requires confirmation for each chat.",
          "Operations the user decides require it",
        ],
      ],
      note: "Network and Web Search are separate from the permission mode. Unsupported provider capabilities are not shown.",
    },
    workflow: [
      {
        title: "Add the context you need",
        body: "Use Ask AI on a selection, the Add menu, image paste or drop, or an action on the current Rendered Diff change. Before sending, you can remove an item or return to its source.",
        screenshot: screenshot(
          "ai-chat-context-access.png",
          "Explicit context and Agent Access",
          "Shows a selected passage attached to the composer with Observe access.",
          "Svard AI Chat showing a selection and Agent Access",
        ),
      },
      {
        title: "Confirm the operating boundary",
        body: "Choose Observe, Agent, or Full Access before sending. Full Access requires confirmation for every new chat regardless of the saved default.",
        screenshot: screenshot(
          "ai-chat-display-review.png",
          "Change review and display targets",
          "Shows the Changed files review path beside AI Chat display targets.",
          "Svard AI Chat showing Changed files and display targets",
        ),
      },
    ],
    limitations:
      "Selections, images, and changes are explicit turn context and are not inherited automatically by the next question. Absolute paths, provider-internal IDs, and raw reasoning are not shown in the UI or public artifacts.",
    related: [
      "Get started with AI Chat",
      "AI Chat conversations and change review",
      "Copy and reference for AI",
    ],
  },
  aiChatConversationReview: {
    title: "AI Chat conversations and change review",
    lead: "Keep the conversation while changing its location, adjust a running turn, and review files reported as changed by Codex.",
    whatThisFeatureIs:
      "AI Chat preserves the same conversation, draft, running turn, and approval state across Right side, Bottom, Diff Preview, and Separate window. Chats created by Svard can be resumed, renamed, archived, restored, and deleted from Recent or Archived.",
    whenToUse:
      "Use it to read a long answer in a separate window, keep a diff beside the conversation, return to an earlier question, or inspect files Codex reports as changed.",
    workflow: [
      {
        title: "Manage conversations",
        body: "Use New Chat to separate work, then return to Svard-created chats from Recent or Archived. Rename, Archive or Restore, and confirmed Delete are available from the same list.",
        screenshot: screenshot(
          "ai-chat-session-history.png",
          "AI Chat conversation history",
          "Shows the entry for returning to Recent and Archived chats.",
          "Svard AI Chat showing conversation history",
        ),
      },
      {
        title: "Adjust a running turn",
        body: "Queue can hold one next input. Steer sends an instruction to the current turn, while Stop and Send stops the current work and sends the new input.",
      },
      {
        title: "Review changed files",
        body: "Select Review changes from Changed files to open the current Source Control > Changes view without closing AI Chat. Svard reviews the current working tree rather than a stored raw diff.",
        screenshot: screenshot(
          "ai-chat-display-review.png",
          "Display target and change review",
          "Shows the AI Chat display menu and the path from Changed files to review.",
          "Svard AI Chat showing display and changed-file review actions",
        ),
      },
    ],
    limitations:
      "This does not provide simultaneous control of one chat from multiple windows. Either Main or Separate window is the interactive owner. Review changes does not stage, commit, or discard files.",
    related: [
      "Get started with AI Chat",
      "AI Chat context and Agent Access",
      "Source Control changes",
    ],
  },
  copyReferencesForAi: {
    title: "Copy and reference for AI",
    lead: "Copy rendered content and its source identity separately so AI Chat or an external review receives only the information it needs.",
    whatThisFeatureIs:
      "Text, source, images, diagrams, and Rendered Diff expose actions for copying the visible content or adding a workspace-relative reference. You can choose the content, image, or reference appropriate for the destination.",
    whenToUse:
      "Use it when quoting Svard content in another tool, adding provenance to a review comment, or identifying a diagram or diff without copying the whole document.",
    supportMatrix: {
      title: "Representative copy actions",
      columns: ["Target", "Example action", "Output"],
      rows: [
        [
          "Text or selection",
          "Copy Text Reference",
          "Visible text with its document reference",
        ],
        [
          "Source",
          "Copy Source / Copy Source Reference",
          "Original markup or source identity",
        ],
        [
          "Image or diagram",
          "Copy Image / Copy Image with Reference",
          "Rendered image, optionally with provenance",
        ],
        [
          "Rendered Diff",
          "Copy Diff Reference",
          "Relative identity including the comparison",
        ],
      ],
      note: "Available actions depend on the selected target and whether reliable source information exists.",
    },
    workflow: [
      {
        title: "Choose text or source",
        body: "Open the context menu in a rendered document and choose whether to copy the content or include a Source or Text Reference.",
        screenshot: screenshot(
          "copy-reference-actions.png",
          "Text and source copy actions",
          "Shows content, source, and reference copy actions on a public document.",
          "Svard document context menu showing text and source copy actions",
        ),
      },
      {
        title: "Copy an image or diagram",
        body: "Use Copy Image for the rendered image alone, or Copy Image with Reference or a diagram Copy Reference action when provenance is needed.",
        screenshot: screenshot(
          "copy-image-reference.png",
          "Copy image with a reference",
          "Shows image copy and referenced-image copy actions on rendered content.",
          "Svard showing Copy Image and Copy Image with Reference",
        ),
      },
    ],
    limitations:
      "References are limited to locations Svard can resolve inside the workspace. Public Docs and screenshots do not include copied values, absolute paths, private document text, diagram source, or credentials.",
    related: [
      "Document actions",
      "Table copy actions",
      "AI Chat context and Agent Access",
    ],
  },
};

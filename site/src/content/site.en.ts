import { screenshot } from "./screenshots";
import { sitePath } from "./paths";

const repositoryUrl = "https://github.com/yyamamot/Svard";
const releasesUrl = "https://github.com/yyamamot/Svard/releases";
const changelogUrl = "https://github.com/yyamamot/Svard/blob/main/CHANGELOG.md";
const issuesUrl = "https://github.com/yyamamot/Svard/issues";

export const site = {
  locale: "en",
  title: "Svard",
  description: "A desktop viewer for reading AsciiDoc and Markdown.",
  nav: {
    top: "Top",
    features: "Features",
    docs: "Docs",
    download: "Download",
    languageLabel: "Japanese",
    languageHref: sitePath("ja/"),
  },
  footer: {
    summary:
      "Svard is a desktop viewer for reading, searching, and comparing local technical documents.",
    links: [
      { label: "GitHub", href: repositoryUrl },
      { label: "Releases", href: releasesUrl },
      { label: "Issues", href: issuesUrl },
    ],
  },
  top: {
    eyebrow: "Local-first document viewer",
    heading: "Svard",
    lead: "A desktop viewer for rendered AsciiDoc and Markdown diff review.",
    body: "Open local technical documents safely, render Markdown and AsciiDoc first, then compare reader-visible changes across prose, lists, tables, diagrams, and source views.",
    primaryLink: { label: "Download", href: sitePath("en/download/") },
    secondaryLink: { label: "Features", href: sitePath("en/features/") },
    screenshot: {
      ...screenshot(
        "rendered-diff.png",
        "Rendered diff review",
        "Shows Markdown and AsciiDoc reviewed as rendered output, with reader-visible changes compared side by side.",
        "Svard showing rendered output diff comparison",
      ),
    },
    screenshotGallery: [
      {
        ...screenshot(
          "reader-main.png",
          "Main window screenshot",
          "Shows a local document open with the file tree and document preview visible.",
          "Svard showing the Product Guide document",
        ),
      },
      {
        ...screenshot(
          "search.png",
          "Search screenshot",
          "Shows current-file search results alongside highlighted matches in the document.",
          "Svard showing document search",
        ),
      },
      {
        ...screenshot(
          "hero-plantuml.png",
          "PlantUML diagram",
          "Shows a public sample document with a PlantUML diagram rendered in the document preview.",
          "Svard showing a PlantUML Alice to Bob sequence diagram",
        ),
      },
    ],
    highlights: [
      {
        title: "Read AsciiDoc / Markdown",
        body: "Designed as a viewer for technical documents, not as an editing tool.",
      },
      {
        title: "Separate search scopes",
        body: "Search the current document or the full workspace without breaking reading flow.",
      },
      {
        title: "Compare rendered diffs",
        body: "Compare changes as rendered documents, not only as source line diffs.",
      },
      {
        title: "Render diagrams locally",
        body: "Mermaid, PlantUML, and Graphviz use local rendering as the primary path.",
      },
      {
        title: "Use browser-like navigation",
        body: "Move between documents with tabs, back and forward navigation, bookmarks, and mouse gestures.",
      },
      {
        title: "Review Git changes",
        body: "Review Git changes and differences from GitHub or GitLab merge targets as reader-visible rendered output.",
      },
    ],
    privacy: {
      title: "Local-first boundary",
      body: "Svard assumes local files. Kroki is treated only as a fallback for unsupported, fully compatible, or explicitly configured cases. It is not an implicit public-service default.",
    },
    diff: {
      title: "Compare the rendered result",
      body: "Git and file-to-file comparison are organized around rendered Markdown and AsciiDoc output, not only line-based source diffs. Prose, lists, tables, and diagrams can be reviewed in the form readers actually see.",
    },
    faq: [
      {
        question: "Is Svard an editor?",
        answer:
          "No. Svard focuses on reading, navigation, and comparison as a desktop viewer.",
      },
      {
        question: "Does Svard use public Kroki by default?",
        answer:
          "No. Public Kroki is not an implicit default. Fallback requires explicit user configuration.",
      },
      {
        question: "Do I need to install the Git command?",
        answer:
          "No. Git support is integrated into Svard, so you do not need to install a separate Git command just to review diffs.",
      },
    ],
  },
  features: {
    eyebrow: "Features",
    heading: "Capabilities for reading, searching, and comparing.",
    lead: "Svard is not an editor or IDE. It is a local-first desktop viewer for technical documents.",
    screenshot: {
      ...screenshot(
        "reader-main.png",
        "Reader view",
        "Shows the reader surface with a public sample document open.",
        "Svard document reader view",
      ),
    },
    sections: [
      {
        title: "AsciiDoc / Markdown reading",
        body: "Open AsciiDoc and Markdown technical documents as a viewer. Svard does not rewrite source for viewer convenience.",
        screenshot: screenshot(
          "reader-main.png",
          "Reading screenshot",
          "Shows a local document opened in the reading view.",
          "Svard reading view",
        ),
      },
      {
        title: "Files",
        body: "Open a local folder and choose AsciiDoc or Markdown documents from the file tree. Git change status is visible directly in the tree.",
        screenshot: screenshot(
          "files.png",
          "Files screenshot",
          "Shows local documents selected from the file tree.",
          "Svard Files view",
        ),
      },
      {
        title: "Current File / All Files search",
        body: "Separate searching within the current document from searching across the workspace.",
        screenshot: screenshot(
          "search.png",
          "Search screenshot",
          "Shows the search panel and matching content in the reader.",
          "Svard search view",
        ),
      },
      {
        title: "Preview-based diff review",
        body: "Review Git changes and differences from GitHub or GitLab merge targets in the preview, not only as source line diffs.",
        screenshot: screenshot(
          "rendered-diff.png",
          "Preview diff screenshot",
          "Shows visible document changes in the rendered diff preview.",
          "Svard preview diff view",
        ),
      },
      {
        title: "Source Control",
        body: "Use Git changes, branch diffs, and file history as entry points for document review in the same workspace.",
        screenshot: screenshot(
          "source-control.png",
          "Source Control screenshot",
          "Shows Source Control as the entry point for reviewing document changes.",
          "Svard Source Control view",
        ),
      },
      {
        title: "Local diagram rendering",
        body: "Mermaid, PlantUML, and Graphviz use local rendering as the primary path.",
        screenshot: screenshot(
          "hero-plantuml.png",
          "PlantUML diagram",
          "Shows a locally rendered diagram inside the document preview.",
          "Svard showing a PlantUML diagram",
        ),
      },
      {
        title: "Explicit Kroki fallback",
        body: "Kroki is only a fallback for unsupported, fully compatible, or explicitly configured cases.",
        screenshot: screenshot(
          "kroki-fallback.png",
          "Kroki preference screenshot",
          "Shows settings where external fallback is configured explicitly.",
          "Svard Kroki fallback preference view",
        ),
      },
      {
        title: "Bookmark management",
        body: "Bookmark frequently used folders and documents, then use them as stable entry points for reading.",
        screenshot: screenshot(
          "navigation.png",
          "Bookmarks screenshot",
          "Shows bookmarked folders and documents as stable reading entry points.",
          "Svard bookmark management view",
        ),
      },
      {
        title: "Privacy boundary",
        body: "Avoid casually exposing diagram source, full document text, local absolute paths, or service URLs to services or logs.",
        screenshot: screenshot(
          "privacy-boundary.png",
          "Privacy screenshot",
          "Shows settings that explain what should stay out of public artifacts.",
          "Svard privacy boundary preference view",
        ),
      },
    ],
  },
  docs: {
    eyebrow: "Docs",
    lead: "Svard is a desktop viewer for reading, searching, and comparing local technical documents.",
    plannedLabel: "Planned",
    overview: {
      title: "What is Svard",
      lead: "Svard is a desktop viewer for reading, searching, and comparing local technical documents.",
      notice: {
        title: "Release status",
        body: "These docs may include features prepared for an upcoming release or features that are not yet included in the current public build. Check the release notes and the distributed app for the exact feature set available in your version.",
      },
      sections: [
        {
          title: "A workspace for local documents",
          body: [
            "Svard displays AsciiDoc and Markdown source without rewriting it for viewer convenience. Open a local folder, move between documents, and read technical material that includes diagrams, tables, and structured content.",
          ],
        },
        {
          title: "Review changes as documents",
          body: [
            "Svard focuses on reader-visible changes, not only source-line diffs. When a review involves tables, lists, or diagrams, the goal is to make the document-level change easier to inspect.",
          ],
        },
        {
          title: "Local-first boundaries",
          body: [
            "Documents, diagrams, and comparison results are handled locally by default. External services require explicit configuration, and public screenshots or logs should not expose private paths, tokens, endpoint URLs, or full source text.",
          ],
        },
      ],
    },
    featureEyebrow: "Feature docs",
    backLabel: "Back to docs",
    articleLabels: {
      whatThisFeatureIs: "What this feature is",
      whenToUse: "When to use",
      whatItDoes: "What it does",
      howItWorks: "How it works",
      notesAndLimits: "Notes and limits",
      related: "Related features",
    },
    groups: [
      {
        title: "Getting Started",
        items: [
          {
            slug: "what-is-svard",
            title: "What is Svard",
            body: "Understand Svard as a local-first desktop viewer for technical documents.",
            state: "Available",
            href: sitePath("en/docs/"),
          },
          {
            slug: "first-document",
            title: "Read your first document",
            body: "Open a folder and start reading the first AsciiDoc or Markdown document.",
            state: "Available",
            href: sitePath("en/docs/features/first-document/"),
          },
          {
            slug: "privacy-model",
            title: "Local-first privacy model",
            body: "See how Svard avoids implicit public-service defaults.",
            state: "Available",
            href: sitePath("en/docs/features/privacy-model/"),
          },
        ],
      },
      {
        title: "Reading Documents",
        items: [
          {
            slug: "reading-markup",
            title: "AsciiDoc and Markdown reading",
            body: "Read technical documents without rewriting source for viewer convenience.",
            state: "Available",
            href: sitePath("en/docs/features/reading-markup/"),
          },
          {
            slug: "table-of-contents",
            title: "Table of contents",
            body: "Use the generated outline to move through long documents.",
            state: "Available",
            href: sitePath("en/docs/features/table-of-contents/"),
          },
          {
            slug: "includes-local-assets",
            title: "Includes and local assets",
            body: "Render safe includes and local assets within the reader boundary.",
            state: "Available",
            href: sitePath("en/docs/features/includes-local-assets/"),
          },
          {
            slug: "themes-zoom",
            title: "Themes and zoom",
            body: "Tune document appearance for reading instead of authoring.",
            state: "Available",
            href: sitePath("en/docs/features/themes-zoom/"),
          },
          {
            slug: "zen-mode",
            title: "Zen Mode",
            body: "Reduce surrounding chrome when the document needs focus.",
            state: "Available",
            href: sitePath("en/docs/features/zen-mode/"),
          },
        ],
      },
      {
        title: "Navigation",
        items: [
          {
            slug: "tabs-open-files",
            title: "Tabs and Open Files",
            body: "Move between active documents in a reading workspace.",
            state: "Available",
            href: sitePath("en/docs/features/tabs-open-files/"),
          },
          {
            slug: "documents-order",
            title: "Documents order",
            body: "Use path, MkDocs, or Antora order when browsing supported documents.",
            state: "Available",
            href: sitePath("en/docs/features/documents-order/"),
          },
          {
            slug: "history-recently-closed",
            title: "History and recently closed",
            body: "Return to documents and tabs without rebuilding context.",
            state: "Available",
            href: sitePath("en/docs/features/history-recently-closed/"),
          },
          {
            slug: "split-view",
            title: "Split View",
            body: "Read two documents or views side by side.",
            state: "Available",
            href: sitePath("en/docs/features/split-view/"),
          },
          {
            slug: "quick-open",
            title: "Quick Open",
            body: "Jump to documents without browsing a long tree.",
            state: "Available",
            href: sitePath("en/docs/features/quick-open/"),
          },
          {
            slug: "bookmarks",
            title: "Bookmarks",
            body: "Keep frequently read folders and documents close.",
            state: "Available",
            href: sitePath("en/docs/features/bookmarks/"),
          },
        ],
      },
      {
        title: "Search",
        items: [
          {
            slug: "current-file-search",
            title: "Current file search",
            body: "Find text inside the document you are reading.",
            state: "Available",
            href: sitePath("en/docs/features/current-file-search/"),
          },
          {
            slug: "workspace-search",
            title: "Workspace search",
            body: "Search across the opened folder when the document is unknown.",
            state: "Available",
            href: sitePath("en/docs/features/workspace-search/"),
          },
          {
            slug: "search-result-navigation",
            title: "Search result navigation",
            body: "Move between matches without losing reading context.",
            state: "Available",
            href: sitePath("en/docs/features/search-result-navigation/"),
          },
        ],
      },
      {
        title: "Diagrams",
        items: [
          {
            slug: "local-diagram-rendering",
            title: "Local diagram rendering",
            body: "Render Mermaid, PlantUML, and Graphviz locally as the primary path.",
            state: "Available",
            href: sitePath("en/docs/features/local-diagram-rendering/"),
          },
          {
            slug: "diagram-inspector",
            title: "Diagram Inspector",
            body: "Review diagrams from a dedicated sidebar list.",
            state: "Available",
            href: sitePath("en/docs/features/diagram-inspector/"),
          },
          {
            slug: "kroki-fallback",
            title: "Explicit Kroki fallback",
            body: "Use Kroki only for unsupported, fully compatible, or explicitly configured cases.",
            state: "Available",
            href: sitePath("en/docs/features/kroki-fallback/"),
          },
          {
            slug: "external-plantuml-fallback",
            title: "External PlantUML fallback",
            body: "Use a user-provided PlantUML path for advanced cases.",
            state: "Available",
            href: sitePath("en/docs/features/external-plantuml-fallback/"),
          },
          {
            slug: "diagram-export-preview",
            title: "Diagram export and preview",
            body: "Preview diagrams and save rendered SVG when needed.",
            state: "Available",
            href: sitePath("en/docs/features/diagram-export-preview/"),
          },
          {
            slug: "diagram-loading-cache",
            title: "Fast diagram loading and cache",
            body: "Keep diagram rendering responsive for long documents.",
            state: "Available",
            href: sitePath("en/docs/features/diagram-loading-cache/"),
          },
        ],
      },
      {
        title: "Preview-Based Review",
        items: [
          {
            slug: "preview-diff-review",
            title: "Preview-based diff review",
            body: "Review visible document changes, not only source line diffs.",
            state: "Available",
            href: sitePath("en/docs/features/preview-diff-review/"),
          },
          {
            slug: "file-compare",
            title: "File-to-file compare",
            body: "Compare two markup files through the same preview review workspace.",
            state: "Available",
            href: sitePath("en/docs/features/file-compare/"),
          },
          {
            slug: "cli-file-compare",
            title: "CLI file compare",
            body: "Open a two-file comparison from the desktop open path.",
            state: "Available",
            href: sitePath("en/docs/features/cli-file-compare/"),
          },
          {
            slug: "table-list-diff-review",
            title: "Table and list diff review",
            body: "Review structured changes in rendered lists and tables.",
            state: "Available",
            href: sitePath("en/docs/features/table-list-diff-review/"),
          },
          {
            slug: "change-navigator",
            title: "Change Navigator",
            body: "Move between rendered changes in the preview.",
            state: "Available",
            href: sitePath("en/docs/features/change-navigator/"),
          },
          {
            slug: "fallback-visibility",
            title: "Fallback visibility",
            body: "See when a precise rendered diff falls back to a broader block.",
            state: "Available",
            href: sitePath("en/docs/features/fallback-visibility/"),
          },
        ],
      },
      {
        title: "Change Review Mode",
        items: [
          {
            slug: "change-review-mode",
            title: "Change Review Mode",
            body: "Review current changes in the normal reader.",
            state: "Available",
            href: sitePath("en/docs/features/change-review-mode/"),
          },
          {
            slug: "list-item-markers",
            title: "List item markers",
            body: "Identify changed list items while reading.",
            state: "Available",
            href: sitePath("en/docs/features/list-item-markers/"),
          },
          {
            slug: "table-cell-markers",
            title: "Table row and cell markers",
            body: "Highlight changed table rows and cells when confidence is high.",
            state: "Available",
            href: sitePath("en/docs/features/table-cell-markers/"),
          },
        ],
      },
      {
        title: "Source Control",
        items: [
          {
            slug: "source-control-changes",
            title: "Changes list",
            body: "Use local changes as document-review entry points.",
            state: "Available",
            href: sitePath("en/docs/features/source-control-changes/"),
          },
          {
            slug: "branch-diff",
            title: "Branch Diff",
            body: "Review branch differences without leaving the reader workflow.",
            state: "Available",
            href: sitePath("en/docs/features/branch-diff/"),
          },
          {
            slug: "repo-graph",
            title: "Repo Graph",
            body: "Inspect repository history as a read-only review surface.",
            state: "Available",
            href: sitePath("en/docs/features/repo-graph/"),
          },
          {
            slug: "file-history",
            title: "File History",
            body: "Open past changes for a selected document.",
            state: "Available",
            href: sitePath("en/docs/features/file-history/"),
          },
          {
            slug: "commit-details-ref-compare",
            title: "Commit details and ref compare",
            body: "Compare refs and inspect commit context for documents.",
            state: "Available",
            href: sitePath("en/docs/features/commit-details-ref-compare/"),
          },
        ],
      },
      {
        title: "Context Actions",
        items: [
          {
            slug: "document-actions",
            title: "Document actions",
            body: "Use right-click actions from the rendered document body.",
            state: "Available",
            href: sitePath("en/docs/features/document-actions/"),
          },
          {
            slug: "heading-toc-actions",
            title: "Heading and Contents actions",
            body: "Copy links and navigate from headings and the Contents sidebar.",
            state: "Available",
            href: sitePath("en/docs/features/heading-toc-actions/"),
          },
          {
            slug: "table-copy-actions",
            title: "Table copy actions",
            body: "Copy rendered table content without treating Svard as a spreadsheet editor.",
            state: "Available",
            href: sitePath("en/docs/features/table-copy-actions/"),
          },
          {
            slug: "link-document-actions",
            title: "Link inspection and document actions",
            body: "Inspect link targets before opening or copying them.",
            state: "Available",
            href: sitePath("en/docs/features/link-document-actions/"),
          },
          {
            slug: "sidebar-tab-actions",
            title: "Sidebar and tab actions",
            body: "Manage open files, bookmarks, tabs, and sidebar items.",
            state: "Available",
            href: sitePath("en/docs/features/sidebar-tab-actions/"),
          },
        ],
      },
      {
        title: "Preferences",
        items: [
          {
            slug: "general-settings",
            title: "General settings",
            body: "Control reading preferences without exposing internal config fields.",
            state: "Available",
            href: sitePath("en/docs/features/general-settings/"),
          },
          {
            slug: "zen-mode",
            title: "Zen Mode",
            body: "Adjust focused reading display behavior.",
            state: "Available",
            href: sitePath("en/docs/features/zen-mode/"),
          },
          {
            slug: "diagram-settings",
            title: "Diagram settings",
            body: "Configure diagram behavior around local rendering first.",
            state: "Available",
            href: sitePath("en/docs/features/diagram-settings/"),
          },
          {
            slug: "kroki-settings",
            title: "Kroki settings",
            body: "Set explicit fallback behavior for Kroki-compatible diagrams.",
            state: "Available",
            href: sitePath("en/docs/features/kroki-settings/"),
          },
          {
            slug: "network-provider-settings",
            title: "Network settings",
            body: "Review network settings used by explicit external access.",
            state: "Available",
            href: sitePath("en/docs/features/network-provider-settings/"),
          },
          {
            slug: "pr-mr-providers",
            title: "PR / MR Providers",
            body: "Configure PR / MR target branch detection for Branch Diff.",
            state: "Available",
            href: sitePath("en/docs/features/pr-mr-providers/"),
          },
          {
            slug: "security-settings",
            title: "Security settings",
            body: "Control external image and local-file boundaries.",
            state: "Available",
            href: sitePath("en/docs/features/security-settings/"),
          },
          {
            slug: "mouse-gestures",
            title: "Mouse Gestures",
            body: "Review and adjust right-button drag gestures.",
            state: "Available",
            href: sitePath("en/docs/features/mouse-gestures/"),
          },
          {
            slug: "keybindings",
            title: "Keybindings",
            body: "Review and adjust keyboard shortcuts for frequent actions.",
            state: "Available",
            href: sitePath("en/docs/features/keybindings/"),
          },
        ],
      },
      {
        title: "Reference",
        items: [
          {
            slug: "supported-diagrams",
            title: "Supported diagrams",
            body: "Check local and fallback diagram support at a glance.",
            state: "Available",
            href: sitePath("en/docs/features/supported-diagrams/"),
          },
          {
            slug: "command-palette",
            title: "Command palette",
            body: "Open documents, headings, and commands from one focused entry point.",
            state: "Available",
            href: sitePath("en/docs/features/command-palette/"),
          },
        ],
      },
    ],
    features: {
      firstDocument: {
        title: "Read your first document",
        lead: "Read your first document shows how to open a local folder, choose a document, and start reading it in the preview.",
        whatThisFeatureIs:
          "Svard opens AsciiDoc and Markdown from a local folder as documents to read, not as files to edit. Opening a folder is a reading entry point, not a project creation flow.",
        whenToUse:
          "Use this after opening Svard for the first time and deciding which local folder and document to read.",
        workflow: [
          {
            title: "Open a local folder",
            body: "Use File > Open Folder... or the open button in the file tree toolbar to choose the local folder you want to read.",
            screenshot: screenshot(
              "first-document-open-folder.png",
              "Open Folder entry",
              "Shows the Open Folder... entry before choosing a local folder.",
              "Svard Open Folder menu",
            ),
          },
          {
            title: "Read in the preview",
            body: "Select an AsciiDoc or Markdown document and read it as a rendered preview without rewriting the source file.",
            screenshot: screenshot(
              "first-document-reader.png",
              "Rendered document reader",
              "Shows a public-safe document opened without Git status badges.",
              "Svard reader showing the first opened document",
            ),
          },
        ],
        limitations:
          "This page covers the first reading path only. Git change indicators, editing, search, diff review, and settings are covered by separate feature pages.",
        related: [
          "AsciiDoc and Markdown reading",
          "Current file search",
          "Local-first privacy model",
        ],
        screenshots: [
          screenshot(
            "first-document-open-folder.png",
            "Open Folder entry",
            "Shows the Open Folder... entry before choosing a local folder.",
            "Svard Open Folder menu",
          ),
          screenshot(
            "first-document-reader.png",
            "Rendered document reader",
            "Shows a public-safe document opened without Git status badges.",
            "Svard reader showing the first opened document",
          ),
        ],
      },
      privacyModel: {
        title: "Local-first privacy model",
        lead: "Svard handles documents locally by default and does not assume implicit public-service use.",
        whatThisFeatureIs:
          "Svard treats local documents, diagrams, and comparison results as local-first data. External services are supplemental paths only when the user explicitly configures them.",
        whenToUse:
          "Review this before reading internal documents, design notes, or review material that may contain information that should not appear in public artifacts.",
        workflow: [
          {
            title: "Start from local documents",
            body: "Svard reads documents from the local folder and does not make public-service upload the default path.",
            screenshot: screenshot(
              "files.png",
              "Local document entry",
              "Shows the file tree used to choose a local document.",
              "Svard file tree with local documents",
            ),
          },
          {
            title: "Keep public artifacts clean",
            body: "Screenshots and logs should not expose local absolute paths, credentials, service URLs, or full document text.",
            screenshot: screenshot(
              "privacy-boundary.png",
              "Privacy boundary",
              "Shows a preference view that explains the privacy boundary.",
              "Svard privacy boundary preference view",
            ),
          },
        ],
        limitations:
          "This page explains the public Docs boundary. It is not a complete security feature reference, audit process, or replacement for organizational policy.",
        related: [
          "What is Svard",
          "Explicit Kroki fallback",
          "Security settings",
        ],
        screenshots: [
          screenshot(
            "files.png",
            "Local document entry",
            "Shows the file tree used to choose a local document.",
            "Svard file tree with local documents",
          ),
          screenshot(
            "privacy-boundary.png",
            "Privacy boundary",
            "Shows a preference view that explains the privacy boundary.",
            "Svard privacy boundary preference view",
          ),
        ],
      },
      documentsOrder: {
        title: "Documents order",
        lead: "Documents order helps the Documents only view follow the structure used by static documentation sites.",
        whatThisFeatureIs:
          "Svard can show supported documents by file path, static MkDocs nav order, or local Antora navigation order when those sources are detected. This keeps a document set closer to the reading order used by the published docs without running the site generator.",
        whenToUse:
          "Use this when a folder contains many Markdown or AsciiDoc files and the file tree order does not match how readers move through the documentation.",
        workflow: [
          {
            title: "Choose a documents order",
            body: "Open Files, switch to Documents only, then choose Docs: Path, Docs: MkDocs, or Docs: Antora from the view mode menu when available.",
            screenshot: screenshot(
              "documents-order.png",
              "Static-site documents order",
              "Shows Documents only using a static-site section order in the Files sidebar.",
              "Svard Documents only view ordered by static-site navigation",
            ),
          },
          {
            title: "Keep review filters available",
            body: "All and Changed stay in the same place. Git badges and open indicators continue to work while rows follow the selected document order.",
          },
          {
            title: "Use lightweight static parsing",
            body: "MkDocs uses static mkdocs.yml nav and docs_dir. Antora uses local antora.yml nav files and standard antora-playbook.yml content roots as discovery hints.",
          },
        ],
        supportMatrix: {
          title: "Supported order sources",
          lead: "Documents order is a lightweight local ordering aid, not a static-site build.",
          columns: ["Source", "Support", "Notes"],
          rows: [
            [
              "Path",
              "Supported",
              "Default order for loaded supported documents in the file tree.",
            ],
            [
              "MkDocs static nav",
              "Supported",
              "Reads local mkdocs.yml / mkdocs.yaml docs_dir and nav without running plugins.",
            ],
            [
              "Antora static nav",
              "Supported",
              "Reads local antora.yml nav files and standard antora-playbook.yml local content roots.",
            ],
            [
              "Generated or plugin nav",
              "Unsupported",
              "MkDocs plugins, Antora extensions, remote fetch, and build-generated navigation are not executed.",
            ],
            [
              "Missing nav entries",
              "Partial",
              "Known nav documents outside the loaded file tree can appear as missing rows; extra loaded documents stay in a Not in nav group.",
            ],
          ],
          note: "All sources stay inside the opened local workspace boundary and do not expose source bodies, private absolute paths, or remote endpoint values.",
        },
        limitations:
          "Svard does not execute MkDocs plugins, Antora builds, Antora extensions, remote repository fetches, or generated navigation. Unsupported or dynamic navigation falls back to path order or shows only the local static subset that can be read safely.",
        related: ["Tabs and Open Files", "Quick Open", "Source Control changes"],
        screenshots: [
          screenshot(
            "documents-order.png",
            "Static-site documents order",
            "Shows Documents only using a static-site section order in the Files sidebar.",
            "Svard Documents only view ordered by static-site navigation",
          ),
        ],
      },
      tabsOpenFiles: {
        title: "Tabs and Open Files",
        lead: "Tabs and Open Files keep several documents available while you move through a reading session.",
        whatThisFeatureIs:
          "Svard keeps opened documents as tabs and also lists them in the sidebar. This is not a file-management workflow; it is a way to keep reading context available.",
        whenToUse:
          "Use this when you are reading a design note, guide, and supporting document together and need to return to each document quickly.",
        workflow: [
          {
            title: "Open several documents",
            body: "Open documents from the file tree. The active reading set appears in the tab bar and in Open Files.",
            screenshot: screenshot(
              "tabs-open-files.png",
              "Tabs and Open Files",
              "Shows the file tree and Open Files list together.",
              "Svard file tree and Open Files list",
            ),
          },
          {
            title: "Return to a document",
            body: "Use tabs for quick switching and Open Files to see the current reading session as a list.",
            screenshot: screenshot(
              "tabs-open-files-tabs.png",
              "Switching from the tab bar",
              "Shows the top tab bar when the sidebar is closed.",
              "Svard tab bar with an open document",
            ),
          },
        ],
        limitations:
          "This page covers the roles of tabs, Open Files, and the file tree only. History, recently closed tabs, Split View, and bookmarks are separate features.",
        related: ["History and recently closed", "Split View", "Quick Open"],
        screenshots: [
          screenshot(
            "tabs-open-files.png",
            "Tabs and Open Files",
            "Shows the file tree and Open Files list together.",
            "Svard file tree and Open Files list",
          ),
          screenshot(
            "tabs-open-files-tabs.png",
            "Switching from the tab bar",
            "Shows the top tab bar when the sidebar is closed.",
            "Svard tab bar with an open document",
          ),
        ],
      },
      historyRecentlyClosed: {
        title: "History and recently closed",
        lead: "History and recently closed entries help readers return to documents without rebuilding context.",
        whatThisFeatureIs:
          "Svard keeps recent documents, recent folders, and recently closed tabs available as return points. Recent documents are available from the Start Page or History menu. Closed tabs can be restored from History > Recently Closed, Restore Last Closed File, or the default shortcut. It is a reading-continuity feature, not a replacement for browsing the file tree.",
        whenToUse:
          "Use this after checking another document, switching folders, or closing a tab you need to reopen.",
        supportMatrix: {
          title: "Return paths",
          lead: "The entry point depends on what you want to restore.",
          columns: ["Target", "Entry point", "Notes"],
          rows: [
            [
              "Recent document",
              "Start Page, or History > Recent Documents",
              "Return to a document by name.",
            ],
            [
              "Recent folder",
              "Start Page, or History > Recent Folders",
              "Resume a reading workspace by folder.",
            ],
            [
              "Closed tab",
              "History > Recently Closed",
              "Choose a closed document from the list.",
            ],
            [
              "Last closed tab",
              "Restore Last Closed File, or Cmd+Shift+T / Ctrl+Shift+T",
              "Restore the most recently closed document immediately.",
            ],
          ],
          note: "These are the default shortcuts. If keybindings are customized, follow the shortcut display shown in the app.",
        },
        workflow: [
          {
            title: "Return from recent documents",
            body: "Use the Start Page or History menu to return to recently opened documents and folders. For closed tabs, choose History > Recently Closed, or use Restore Last Closed File / Cmd+Shift+T / Ctrl+Shift+T to reopen the last closed document.",
            screenshot: screenshot(
              "history-recently-closed.png",
              "Recent documents",
              "Shows recent documents and folders on the Start Page.",
              "Svard Start Page showing recent documents",
            ),
          },
        ],
        limitations:
          "This page covers the return entry points only. It does not document every history item, custom shortcut, or detailed tab-restoration condition.",
        related: ["Tabs and Open Files", "Quick Open", "Bookmarks"],
        screenshots: [
          screenshot(
            "history-recently-closed.png",
            "Recent documents",
            "Shows recent documents and folders on the Start Page.",
            "Svard Start Page showing recent documents",
          ),
        ],
      },
      splitView: {
        title: "Split View",
        lead: "Split View places two reading panes side by side for comparison and reference.",
        whatThisFeatureIs:
          "Split View divides the reader into two panes. Use one pane for the main document and the other for a reference document or a related section.",
        whenToUse:
          "Use this when comparing a specification with supporting notes, checking before-and-after explanations, or reading two distant sections together.",
        workflow: [
          {
            title: "Open Split View",
            body: "Press the Split View button in the reader topbar to place the current document into a side-by-side layout. You can also use View > Layout > Split View from the app menu.",
            screenshot: screenshot(
              "split-view-entry.png",
              "Split View button",
              "Shows the Split View button focused in the reader topbar.",
              "Svard reader with the Split View button focused",
            ),
          },
          {
            title: "Read side by side",
            body: "After enabling Split View, open the documents or locations you want to read in each pane. Put the main document on one side and a reference document on the other to compare without switching back and forth.",
            screenshot: screenshot(
              "split-view.png",
              "Split View",
              "Shows the reader divided into two panes.",
              "Svard Split View with two reader panes",
            ),
          },
        ],
        limitations:
          "Split View is a reading layout. This page does not cover every pane action, diff review, or detailed tab-management behavior.",
        related: ["Tabs and Open Files", "Branch Diff", "File-to-file compare"],
        screenshots: [
          screenshot(
            "split-view-entry.png",
            "Split View button",
            "Shows the Split View button focused in the reader topbar.",
            "Svard reader with the Split View button focused",
          ),
          screenshot(
            "split-view.png",
            "Split View",
            "Shows the reader divided into two panes.",
            "Svard Split View with two reader panes",
          ),
        ],
      },
      bookmarks: {
        title: "Bookmarks",
        lead: "Bookmarks keep frequently used folders and documents close in the sidebar.",
        whatThisFeatureIs:
          "Svard bookmarks can point to folders or documents. They help readers return to common reading targets without walking the file tree every time.",
        whenToUse:
          "Use bookmarks for design notes, operating guides, review folders, and other documents you revisit often.",
        workflow: [
          {
            title: "Keep frequent destinations",
            body: "Add folders and documents to the Bookmarks sidebar so they remain available as entry points for future reading sessions.",
            screenshot: screenshot(
              "bookmarks.png",
              "Bookmarks",
              "Shows folders and documents in the Bookmarks sidebar.",
              "Svard Bookmarks sidebar",
            ),
          },
        ],
        limitations:
          "Bookmarks are reading entry points. This page does not cover sync, sharing, external services, or every reordering action.",
        related: [
          "History and recently closed",
          "Tabs and Open Files",
          "Quick Open",
        ],
        screenshots: [
          screenshot(
            "bookmarks.png",
            "Bookmarks",
            "Shows folders and documents in the Bookmarks sidebar.",
            "Svard Bookmarks sidebar",
          ),
        ],
      },
      quickOpen: {
        title: "Quick Open",
        lead: "Quick Open is the keyboard-first entry point for moving to documents, headings, and commands.",
        whatThisFeatureIs:
          "Quick Open is an overlay for finding the next place to go while reading. It can open loaded documents, run commands, jump to headings in the active document, or move to a mapped source line from the same focused input.",
        whenToUse:
          "Use this when you know part of a document name, heading, command, or source line and want to move without repeatedly browsing the sidebar.",
        supportMatrix: {
          title: "Input modes",
          lead: "The first characters in the input switch what Quick Open searches.",
          columns: ["Input", "Searches", "Use it for"],
          rows: [
            [
              "text",
              "Files",
              "Open a loaded, recent, bookmarked, or visible file-tree document.",
            ],
            [
              ">",
              "Commands",
              "Run actions such as opening Preferences, showing Source Control, or starting file compare.",
            ],
            [
              "@",
              "Headings",
              "Jump to a heading in the active document.",
            ],
            [
              ":N",
              "Source line",
              "Jump near a mapped source line, such as a heading, source block, diagnostic, or diagram location.",
            ],
          ],
          note: "# is not a Quick Open mode prefix in the current app. Source-line jumps use : followed by a line number.",
        },
        workflow: [
          {
            title: "Open it from the menu or shortcut",
            body: "Quick Open is opened from File > Quick Open... or the assigned keyboard shortcut. It is not a permanent topbar button.",
          },
          {
            title: "Filter candidates",
            body: "Type plain text for files, > for commands, @ for headings, or : followed by a line number for source-line navigation. The mode label beside the input changes as the prefix changes.",
            screenshot: screenshot(
              "quick-open.png",
              "Quick Open candidates",
              "Shows the Quick Open overlay with the input focused and candidate list visible.",
              "Svard Quick Open candidate list",
            ),
          },
        ],
        limitations:
          "This page explains Quick Open as a navigation entry point. It does not document every command or shell-style search grammar. Actual shortcut display follows the app menu.",
        related: [
          "Tabs and Open Files",
          "Current file search",
          "Search result navigation",
        ],
        screenshots: [
          screenshot(
            "quick-open.png",
            "Quick Open candidates",
            "Shows the Quick Open overlay with the input focused and candidate list visible.",
            "Svard Quick Open candidate list",
          ),
        ],
      },
      readingMarkup: {
        title: "AsciiDoc and Markdown reading",
        lead: "Svard opens local AsciiDoc and Markdown as documents to read, not as files to edit.",
        whatThisFeatureIs:
          "The reader opens Markdown and AsciiDoc in the same reading surface. Headings, lists, and tables are shown as documents, and Svard does not rewrite the source file for viewer convenience.",
        whenToUse:
          "Use this when local guides, design notes, runbooks, or repository documents mix Markdown and AsciiDoc and you do not want to switch tools by format.",
        workflow: [
          {
            title: "Read Markdown as a document",
            body: "Markdown headings, lists, and tables are rendered in the reader. The page focuses on readable output, not an editing surface.",
            screenshot: screenshot(
              "reading-markup-markdown.png",
              "Markdown reading",
              "Shows a Markdown document opened in the reader surface.",
              "Svard showing a rendered Markdown document",
            ),
          },
          {
            title: "Read AsciiDoc as a document",
            body: "AsciiDoc headings, table of contents, and tables are rendered in the same reader contract used for Markdown.",
            screenshot: screenshot(
              "reading-markup-asciidoc.png",
              "AsciiDoc reading",
              "Shows an AsciiDoc document opened in the reader surface.",
              "Svard showing a rendered AsciiDoc document",
            ),
          },
        ],
        limitations:
          "Svard is not an editor. It does not promise authoring features, live collaboration, or full compatibility with every publishing system. Public pages use short samples that show the rendered result clearly.",
        related: [
          "Table of contents",
          "Tabs and Open Files",
          "Current file search",
        ],
        screenshots: [
          screenshot(
            "reading-markup-markdown.png",
            "Markdown reading",
            "Shows a Markdown document opened in the reader surface.",
            "Svard showing a rendered Markdown document",
          ),
          screenshot(
            "reading-markup-asciidoc.png",
            "AsciiDoc reading",
            "Shows an AsciiDoc document opened in the reader surface.",
            "Svard showing a rendered AsciiDoc document",
          ),
        ],
      },
      tableOfContents: {
        title: "Table of contents",
        lead: "The table of contents keeps long documents navigable from the right sidebar.",
        whatThisFeatureIs:
          "Svard builds an outline from the headings in the current document and shows it in the Contents sidebar. You can keep the document structure visible while reading.",
        whenToUse:
          "Use this for specifications, runbooks, and review documents where headings are the fastest way to reach the section you need.",
        workflow: [
          {
            title: "Review the heading outline",
            body: "Open Contents in the right sidebar to see the headings from the current document.",
            screenshot: screenshot(
              "table-of-contents.png",
              "Contents and document",
              "Shows the Contents sidebar and the current document headings together.",
              "Svard showing the Contents sidebar next to a document",
            ),
          },
          {
            title: "Jump to a section",
            body: "Choose an outline item to move to the matching heading without losing the reading context.",
            screenshot: screenshot(
              "table-of-contents-jump.png",
              "After a contents jump",
              "Shows a document after navigating from the Contents sidebar.",
              "Svard after jumping from the Contents sidebar to a heading",
            ),
          },
        ],
        limitations:
          "The outline is generated from document headings. Documents without headings, or headings outside the supported markup path, may not produce useful entries. This page does not cover authoring rules for heading structure.",
        related: [
          "AsciiDoc and Markdown reading",
          "Current file search",
          "Quick Open",
        ],
        screenshots: [
          screenshot(
            "table-of-contents.png",
            "Contents and document",
            "Shows the Contents sidebar and the current document headings together.",
            "Svard showing the Contents sidebar next to a document",
          ),
          screenshot(
            "table-of-contents-jump.png",
            "After a contents jump",
            "Shows a document after navigating from the Contents sidebar.",
            "Svard after jumping from the Contents sidebar to a heading",
          ),
        ],
      },
      includesLocalAssets: {
        title: "Includes and local assets",
        lead: "Svard renders included AsciiDoc content and local images as part of the document without relying on a public service.",
        whatThisFeatureIs:
          "Included content and local images can be checked as rendered output in the reader. Svard shows the resolved reading result without rewriting the source document.",
        whenToUse:
          "Use this when a guide is split across several local files or references images stored beside the document.",
        workflow: [
          {
            title: "Read included content and images",
            body: "The reader shows the included note and local image as part of the rendered document.",
            screenshot: screenshot(
              "includes-local-assets.png",
              "Included content and local image",
              "Shows included content and a local image rendered in the document.",
              "Svard showing included content and a local image",
            ),
          },
          {
            title: "Check the include boundary",
            body: "Contents can show included files as reader context without exposing absolute paths or full source text in public screenshots.",
            screenshot: screenshot(
              "includes-local-assets-boundary.png",
              "Include boundary",
              "Shows included files in the right sidebar.",
              "Svard showing included files in the right sidebar",
            ),
          },
        ],
        limitations:
          "This page uses a small public sample. Unsupported includes, references outside the workspace, oversized assets, and external image behavior follow the reader's safety and settings boundaries.",
        related: [
          "AsciiDoc and Markdown reading",
          "Local-first privacy model",
          "Security settings",
        ],
        screenshots: [
          screenshot(
            "includes-local-assets.png",
            "Included content and local image",
            "Shows included content and a local image rendered in the document.",
            "Svard showing included content and a local image",
          ),
          screenshot(
            "includes-local-assets-boundary.png",
            "Include boundary",
            "Shows included files in the right sidebar.",
            "Svard showing included files in the right sidebar",
          ),
        ],
      },
      themesZoom: {
        title: "Themes and zoom",
        lead: "Themes and zoom are reading controls for making the document easier to inspect.",
        whatThisFeatureIs:
          "Svard treats the app theme, AsciiDoc theme, and document zoom as reading preferences. They change how the document is displayed without changing the document content.",
        whenToUse:
          "Use this when reading for a long time, switching lighting conditions, or checking AsciiDoc output with a different visual style.",
        workflow: [
          {
            title: "Choose display settings",
            body: "Preferences > General shows theme, AsciiDoc theme, and zoom controls together.",
            screenshot: screenshot(
              "themes-zoom-preferences.png",
              "Display settings",
              "Shows theme and zoom controls in Preferences General.",
              "Svard Preferences showing theme and zoom controls",
            ),
          },
          {
            title: "Read with the adjusted display",
            body: "The reader reflects the display settings while leaving the source document unchanged.",
            screenshot: screenshot(
              "themes-zoom-reader.png",
              "Reader after display changes",
              "Shows the reader after theme and zoom settings are applied.",
              "Svard reader with theme and zoom applied",
            ),
          },
        ],
        limitations:
          "Display settings do not alter source files. They are not a guarantee that every publishing system or authoring environment will look identical.",
        related: [
          "AsciiDoc and Markdown reading",
          "Zen Mode",
          "General settings",
        ],
        screenshots: [
          screenshot(
            "themes-zoom-preferences.png",
            "Display settings",
            "Shows theme and zoom controls in Preferences General.",
            "Svard Preferences showing theme and zoom controls",
          ),
          screenshot(
            "themes-zoom-reader.png",
            "Reader after display changes",
            "Shows the reader after theme and zoom settings are applied.",
            "Svard reader with theme and zoom applied",
          ),
        ],
      },
      zenMode: {
        title: "Zen Mode",
        lead: "Zen Mode reduces surrounding UI so the current document can take focus.",
        whatThisFeatureIs:
          "Zen Mode keeps the document centered and can hide the topbar, sidebars, tabs, and status feedback according to preferences. It changes the reading surface, not the document.",
        whenToUse:
          "Use this when you want to read a long specification, review note, or runbook without the surrounding navigation competing for attention.",
        workflow: [
          {
            title: "Enter from the topbar",
            body: "The topbar button is the representative entry point for this page. Other entries exist, but this page is not a shortcut catalog.",
            screenshot: screenshot(
              "zen-mode-entry.png",
              "Zen Mode entry",
              "Shows the focused Zen Mode button in the topbar.",
              "Svard topbar with the Zen Mode button focused",
            ),
          },
          {
            title: "Read with less surrounding UI",
            body: "When Zen Mode is active, the document is centered and surrounding UI is reduced. The floating exit control returns to the normal layout.",
            screenshot: screenshot(
              "zen-mode.png",
              "Zen Mode reader",
              "Shows the reader with surrounding UI reduced.",
              "Svard reader with Zen Mode active",
            ),
          },
        ],
        limitations:
          "Zen Mode is a reading display mode. It is not a presentation mode and does not guarantee that every command is hidden. Detailed behavior follows the Zen Mode preferences.",
        related: ["Themes and zoom", "Tabs and Open Files", "General settings"],
        screenshots: [
          screenshot(
            "zen-mode-entry.png",
            "Zen Mode entry",
            "Shows the focused Zen Mode button in the topbar.",
            "Svard topbar with the Zen Mode button focused",
          ),
          screenshot(
            "zen-mode.png",
            "Zen Mode reader",
            "Shows the reader with surrounding UI reduced.",
            "Svard reader with Zen Mode active",
          ),
        ],
      },
      currentFileSearch: {
        title: "Current file search",
        lead: "Current file search finds text inside the document you are reading without switching to workspace-wide discovery.",
        whatThisFeatureIs:
          "The search surface is scoped to the active document, so readers can find a heading, term, or repeated phrase while keeping the preview in focus.",
        whenToUse:
          "Use this when you already know which document matters and need to move within that document quickly.",
        workflow: [
          {
            title: "Search within the active document",
            body: "Open search for the current file and enter a short public-safe term from the document. The result list and the highlight in the reader stay visible together, so the match can be checked in context.",
            screenshot: screenshot(
              "search.png",
              "Current file search panel",
              "Shows the current file search UI with the matching text highlighted in the reader.",
              "Svard current file search interface",
            ),
          },
        ],
        limitations:
          "Search examples and screenshots must use public-safe terms. Search hit text from local documents should not appear in public artifacts unless the fixture is prepared for publication.",
        related: [
          "Workspace search",
          "Search result navigation",
          "Table of contents",
        ],
        screenshots: [
          screenshot(
            "search.png",
            "Current file search panel",
            "Shows the current file search UI with the matching text highlighted in the reader.",
            "Svard current file search interface",
          ),
        ],
      },
      workspaceSearch: {
        title: "Workspace search",
        lead: "Workspace search finds matching text across the opened folder when you do not know which document contains it.",
        whatThisFeatureIs:
          "Search can move beyond the active document and scan supported documents in the opened folder. Results show the file name, line, and a short snippet so readers can choose where to continue.",
        whenToUse:
          "Use this when a term may appear across design notes, runbooks, review notes, or generated documents and the target file is not known yet.",
        workflow: [
          {
            title: "Search across the folder",
            body: "Switch search to all files and use a short public-safe term from the fixture workspace.",
            screenshot: screenshot(
              "workspace-search.png",
              "Workspace search results",
              "Shows matches found across multiple documents in the opened folder.",
              "Svard workspace search results",
            ),
          },
          {
            title: "Open a result in context",
            body: "Select a result to open the matching document while keeping the search result list available for the next match.",
            screenshot: screenshot(
              "workspace-search-result.png",
              "Document opened from search",
              "Shows a document opened from a workspace search result.",
              "Svard document opened from workspace search",
            ),
          },
        ],
        limitations:
          "Search is scoped to the opened folder and supported documents. Public screenshots should use short fixture terms and avoid local absolute paths or private document text.",
        related: [
          "Current file search",
          "Search result navigation",
          "Quick Open",
        ],
        screenshots: [
          screenshot(
            "workspace-search.png",
            "Workspace search results",
            "Shows matches found across multiple documents in the opened folder.",
            "Svard workspace search results",
          ),
          screenshot(
            "workspace-search-result.png",
            "Document opened from search",
            "Shows a document opened from a workspace search result.",
            "Svard document opened from workspace search",
          ),
        ],
      },
      searchResultNavigation: {
        title: "Search result navigation",
        lead: "Search result navigation keeps the result list connected to the document you open.",
        whatThisFeatureIs:
          "Svard search results are not one-off links. Current file search and workspace search both connect result rows to the matching document location, so readers can move through matches while preserving context.",
        whenToUse:
          "Use this when a term appears in several places and you want to inspect the matches one by one without rebuilding the search.",
        workflow: [
          {
            title: "Open a document from results",
            body: "Choose a result to open the matching document and location while keeping the search results available.",
            screenshot: screenshot(
              "workspace-search-result.png",
              "Document opened from search",
              "Shows a document opened from a search result with the results still available.",
              "Svard document opened from a search result",
            ),
          },
          {
            title: "Review matches in the current document",
            body: "In the current document, use the search field and match position to inspect the surrounding reading context.",
            screenshot: screenshot(
              "search.png",
              "Current file search",
              "Shows current file search with a match visible in the reader.",
              "Svard current file search results",
            ),
          },
        ],
        limitations:
          "Search result navigation is a reading aid. This page does not cover search index internals, every search operator, or replacement. Public screenshots use short public-safe sample terms only.",
        related: ["Current file search", "Workspace search", "Quick Open"],
        screenshots: [
          screenshot(
            "workspace-search-result.png",
            "Document opened from search",
            "Shows a document opened from a search result with the results still available.",
            "Svard document opened from a search result",
          ),
          screenshot(
            "search.png",
            "Current file search",
            "Shows current file search with a match visible in the reader.",
            "Svard current file search results",
          ),
        ],
      },
      localDiagramRendering: {
        title: "Local diagram rendering",
        lead: "Svard renders Mermaid, PlantUML, and Graphviz locally as the primary path for technical documents.",
        whatThisFeatureIs:
          "The viewer shows rendered diagrams inside the document preview, so diagram changes can be read alongside surrounding text and reviewed in diff workflows.",
        whenToUse:
          "Use this when your document contains diagrams that need to be reviewed as part of the reading flow, including architecture notes, sequence diagrams, and dependency diagrams.",
        workflow: [
          {
            title: "Read diagrams as part of the document",
            body: "Rendered diagrams appear in the same preview surface as the surrounding technical document. Double-click an inline diagram, or use the right-click menu, to open it in preview.",
            screenshot: screenshot(
              "diagram-inline-preview-entry.png",
              "Inline diagram",
              "Shows a rendered diagram focused inside the document body.",
              "Svard document body with a locally rendered diagram focused",
            ),
          },
          {
            title: "Inspect a larger preview",
            body: "When a diagram is small inside the document body, open it in preview to inspect the rendered result at a larger size while keeping the reading flow.",
            screenshot: screenshot(
              "diagram-preview.png",
              "Diagram preview",
              "Shows an inline diagram opened in the larger preview.",
              "Svard showing a locally rendered diagram in preview",
            ),
          },
        ],
        limitations:
          "Kroki is treated as a fallback only for unsupported, fully compatible, or explicitly configured cases. Svard does not promise full compatibility with every remote renderer. Public artifacts should not include sensitive information.",
        related: [
          "Explicit Kroki fallback",
          "Diagram Inspector",
          "Diagram export and preview",
          "Preview-based diff review",
        ],
        screenshots: [
          screenshot(
            "diagram-inline-preview-entry.png",
            "Inline diagram",
            "Shows a rendered diagram focused inside the document body.",
            "Svard document body with a locally rendered diagram focused",
          ),
          screenshot(
            "diagram-preview.png",
            "Diagram preview",
            "Shows an inline diagram opened in the larger preview.",
            "Svard showing a locally rendered diagram in preview",
          ),
        ],
      },
      krokiFallback: {
        title: "Explicit Kroki fallback",
        lead: "Explicit Kroki fallback is an opt-in path for diagrams that cannot be handled by local rendering alone.",
        whatThisFeatureIs:
          "Svard keeps local rendering as the primary path. Kroki is a fallback for unsupported diagrams, fully compatible output, or cases where the user has explicitly configured it.",
        whenToUse:
          "Use this when local rendering cannot show a diagram clearly or when a document needs to match an existing publishing environment.",
        workflow: [
          {
            title: "Choose fallback explicitly",
            body: "Fallback is configured from settings. Public screenshots should show the setting surface without exposing configured service values.",
            screenshot: screenshot(
              "kroki-fallback.png",
              "Kroki fallback settings",
              "Shows the settings surface for explicit external fallback.",
              "Svard Kroki fallback settings",
            ),
          },
          {
            title: "Understand the fallback order",
            body: "Svard normally renders Mermaid, PlantUML, and Graphviz locally. When local rendering is not enough, Kroki fallback is tried only for diagrams the user explicitly allows. For PlantUML, an explicitly configured external PlantUML fallback is tried before deciding whether to use Kroki.",
          },
        ],
        limitations:
          "Kroki is not an implicit public-service default. Public artifacts should not include sensitive information. The detailed boundary is covered in the local-first privacy model.",
        related: [
          "Local diagram rendering",
          "Diagram Inspector",
          "Local-first privacy model",
        ],
        screenshots: [
          screenshot(
            "kroki-fallback.png",
            "Kroki fallback settings",
            "Shows the settings surface for explicit external fallback.",
            "Svard Kroki fallback settings",
          ),
        ],
      },
      externalPlantumlFallback: {
        title: "External PlantUML fallback",
        lead: "External PlantUML fallback is an advanced assist path used only when the user explicitly opts in.",
        whatThisFeatureIs:
          "Svard treats PlantUML local rendering as the primary path. External PlantUML fallback is an advanced path for diagrams that cannot be handled locally and only applies when the user downloads a Native PlantUML executable and configures it explicitly.",
        whenToUse:
          "Use this when local rendering is not enough for a PlantUML diagram and you can manage a downloaded Native PlantUML executable locally.",
        workflow: [
          {
            title: "Check local rendering first",
            body: "The normal path starts with local rendering. Use the Diagrams tab to inspect renderer and status.",
            screenshot: screenshot(
              "diagram-inspector.png",
              "Diagram status",
              "Shows multiple diagram entries and status in the Diagrams tab.",
              "Svard Diagrams tab",
            ),
          },
          {
            title: "Configure Native PlantUML",
            body: "External PlantUML fallback requires the user to download native-plantuml from PlantUML releases separately and set the local executable path. native-plantuml is a Native Image distribution of PlantUML. The standard PlantUML download page is also useful for release and license information. Svard does not bundle or fetch it automatically; it only uses the configured local executable.",
            links: [
              {
                label: "PlantUML GitHub Releases",
                href: "https://github.com/plantuml/plantuml/releases",
              },
              {
                label: "PlantUML downloads",
                href: "https://plantuml.com/download",
              },
            ],
            screenshot: screenshot(
              "external-plantuml-fallback.png",
              "External PlantUML fallback settings",
              "Shows explicit external PlantUML fallback settings.",
              "Svard external PlantUML fallback settings",
            ),
          },
          {
            title: "Check the PlantUML order",
            body: "PlantUML starts with local rendering. External PlantUML fallback is used only when local rendering fails and a Native PlantUML executable has been configured. Kroki fallback remains a separate explicit path, not an automatic public-service handoff.",
          },
        ],
        limitations:
          "This is an advanced opt-in path. The user manages the Native PlantUML download, file placement, execution permission, and Graphviz dot configuration when needed. Check the release source for license and target OS before using a downloaded executable. Svard does not promise full PlantUML compatibility. Public pages do not expose diagram source, local absolute paths, or credentials.",
        related: [
          "Local diagram rendering",
          "Kroki settings",
          "Network and provider settings",
        ],
        screenshots: [
          screenshot(
            "diagram-inspector.png",
            "Diagram status",
            "Shows multiple diagram entries and status in the Diagrams tab.",
            "Svard Diagrams tab",
          ),
          screenshot(
            "external-plantuml-fallback.png",
            "External PlantUML fallback settings",
            "Shows explicit external PlantUML fallback settings.",
            "Svard external PlantUML fallback settings",
          ),
        ],
      },
      diagramInspector: {
        title: "Diagram Inspector",
        lead: "Diagram Inspector shows the diagrams in the current document from the right sidebar.",
        whatThisFeatureIs:
          "It lists diagrams in the document and shows the selected diagram type, render path, status, renderer, and reference location. It is for checking rendered diagram state, not editing diagram source.",
        whenToUse:
          "Use it when a long document contains multiple diagrams, or when you need to confirm whether a diagram rendered locally or needs a fallback path.",
        workflow: [
          {
            title: "Review the diagram list",
            body: "Use the Diagrams tab in the right sidebar to inspect diagrams and the selected diagram details.",
            screenshot: screenshot(
              "diagram-inspector.png",
              "Diagram Inspector",
              "Shows the diagram list and selected diagram details.",
              "Svard Diagram Inspector showing document diagrams",
            ),
          },
          {
            title: "Choose a focused action",
            body: "After checking the rendered result, use focused actions such as preview or save. Public docs do not show diagram source text.",
            screenshot: screenshot(
              "diagram-save-action.png",
              "Diagram action",
              "Shows a representative action in the Diagram Inspector.",
              "Svard Diagram Inspector with Save SVG focused",
            ),
          },
        ],
        limitations:
          "Diagram Inspector is for review and status checks. This page does not cover source editing, every diagram action, or detailed external PlantUML fallback setup. Public artifacts should not include sensitive information.",
        related: [
          "Local diagram rendering",
          "Diagram export and preview",
          "Explicit Kroki fallback",
        ],
        screenshots: [
          screenshot(
            "diagram-inspector.png",
            "Diagram Inspector",
            "Shows the diagram list and selected diagram details.",
            "Svard Diagram Inspector showing document diagrams",
          ),
          screenshot(
            "diagram-save-action.png",
            "Diagram action",
            "Shows a representative action in the Diagram Inspector.",
            "Svard Diagram Inspector with Save SVG focused",
          ),
        ],
      },
      diagramExportPreview: {
        title: "Diagram export and preview",
        lead: "Diagram export and preview lets readers inspect a diagram in a larger preview and save the rendered SVG when needed.",
        whatThisFeatureIs:
          "A rendered diagram can be opened in a separate preview panel for zooming and panning. When useful, the rendered SVG can be saved from the focused diagram action.",
        whenToUse:
          "Use it when a diagram is too small in the document body or when a review needs the rendered diagram output by itself.",
        workflow: [
          {
            title: "Open a larger preview",
            body: "Open Preview from the Diagram Inspector or a diagram action, then adjust the zoom while reviewing the diagram.",
            screenshot: screenshot(
              "diagram-preview.png",
              "Diagram preview",
              "Shows a diagram opened in the preview panel.",
              "Svard diagram preview panel",
            ),
          },
          {
            title: "Save only when needed",
            body: "Saving is one representative action. Svard keeps these actions available when needed instead of making every diagram control permanent chrome.",
            screenshot: screenshot(
              "diagram-save-action.png",
              "Save SVG action",
              "Shows the representative action for saving a rendered SVG.",
              "Svard diagram Save SVG action focused",
            ),
          },
        ],
        limitations:
          "This page is limited to larger preview and SVG save. It does not cover diagram source copy, every menu item, image format conversion, or whole-document export. Public artifacts should not include sensitive information.",
        related: [
          "Diagram Inspector",
          "Local diagram rendering",
          "Local-first privacy model",
        ],
        screenshots: [
          screenshot(
            "diagram-preview.png",
            "Diagram preview",
            "Shows a diagram opened in the preview panel.",
            "Svard diagram preview panel",
          ),
          screenshot(
            "diagram-save-action.png",
            "Save SVG action",
            "Shows the representative action for saving a rendered SVG.",
            "Svard diagram Save SVG action focused",
          ),
        ],
      },
      diagramLoadingCache: {
        title: "Fast diagram loading and cache",
        lead: "Fast diagram loading and cache keep diagram-heavy documents readable while rendering finishes.",
        whatThisFeatureIs:
          "Svard can reserve diagram slots first, make the document readable, and replace those slots as rendering completes. Local diagram results can be cached to make later views faster.",
        whenToUse:
          "Use this when reading long documents with many diagrams, or documents with PlantUML diagrams that can take longer on the first render.",
        workflow: [
          {
            title: "Check the loading behavior",
            body: "Preferences shows the fast diagram loading option that keeps the document readable while diagrams finish rendering.",
            screenshot: screenshot(
              "diagram-loading-cache.png",
              "Fast diagram loading setting",
              "Shows the fast diagram loading setting.",
              "Svard Preferences showing fast diagram loading",
            ),
          },
          {
            title: "Make repeat views faster",
            body: "Cache is an assist for faster repeat views. Public docs do not cover internal storage paths or cache keys.",
          },
        ],
        limitations:
          "This page covers the user-visible loading experience. It does not document internal cache keys, storage locations, renderer internals, or performance metrics. Cache helps repeat views but does not guarantee every diagram appears instantly.",
        related: [
          "Local diagram rendering",
          "Diagram Inspector",
          "Explicit Kroki fallback",
        ],
        screenshots: [
          screenshot(
            "diagram-loading-cache.png",
            "Fast diagram loading setting",
            "Shows the fast diagram loading setting.",
            "Svard Preferences showing fast diagram loading",
          ),
        ],
      },
      previewDiffReview: {
        title: "Preview-based diff review",
        lead: "Preview-based diff review lets readers inspect what changed in the rendered document, not only in source lines.",
        whatThisFeatureIs:
          "The diff workspace is organized around the document preview. It highlights changes in rendered text, lists, tables, and structured blocks where Svard can identify them.",
        whenToUse:
          "Use this when a document change needs review as something people will read, especially when markup source lines are noisy or hard to interpret.",
        workflow: [
          {
            title: "Start from changes or a compare action",
            body: "Open a changed document from Source Control or start a file-to-file compare when you need to compare two markup files.",
            screenshot: screenshot(
              "source-control.png",
              "Source Control review entry",
              "Shows local changes as entry points for preview-based review.",
              "Svard Source Control view for document review",
            ),
          },
          {
            title: "Review changes in the rendered preview",
            body: "Use the preview to inspect visible document changes in context instead of relying only on line-level source changes.",
            screenshot: screenshot(
              "rendered-diff.png",
              "Rendered diff preview",
              "Shows preview-based document changes in the diff workspace.",
              "Svard rendered diff review view",
            ),
          },
        ],
        limitations:
          "Diff review is read-only. It is not a merge editor, patch editor, or source-control command surface. Some complex structures may fall back to broader block-level visibility. The page should explain fallback categories without exposing local source content.",
        related: [
          "File-to-file compare",
          "Table and list diff review",
          "Change Navigator",
        ],
        screenshots: [
          screenshot(
            "source-control.png",
            "Source Control review entry",
            "Shows local changes as entry points for preview-based review.",
            "Svard Source Control view for document review",
          ),
          screenshot(
            "rendered-diff.png",
            "Rendered diff preview",
            "Shows preview-based document changes in the diff workspace.",
            "Svard rendered diff review view",
          ),
        ],
      },
      fileCompare: {
        title: "File-to-file compare",
        lead: "File-to-file compare opens two markup files in the same preview review workspace.",
        whatThisFeatureIs:
          "Svard compares two selected AsciiDoc or Markdown files without requiring a local Git change. The result appears in the same preview-based diff surface used for review.",
        whenToUse:
          "Use this when you need to compare two local drafts, release notes, generated outputs, or document variants as something readers will see.",
        workflow: [
          {
            title: "Choose the files to compare",
            body: "Start from a folder that contains both markup files. The file tree gives the reader a clear view of the two public-safe comparison inputs.",
            screenshot: screenshot(
              "file-compare-files.png",
              "File compare inputs",
              "Shows two local markup files prepared as compare inputs.",
              "Svard file tree showing file-to-file compare inputs",
            ),
          },
          {
            title: "Open the compare action",
            body: "Right-click the other file in the file tree and start the comparison with the active document. This shows the entry point without turning the page into a full operation manual.",
            screenshot: screenshot(
              "file-compare-context-menu.png",
              "File compare context menu",
              "Shows the file tree context menu entry used to start a file comparison.",
              "Svard file tree context menu with file compare action",
            ),
          },
          {
            title: "Review the preview diff",
            body: "Open the comparison and inspect visible document changes in the preview, instead of relying only on source line differences.",
            screenshot: screenshot(
              "file-compare-preview.png",
              "File compare preview diff",
              "Shows the preview diff created from two local markup files.",
              "Svard preview diff for two compared markup files",
            ),
          },
        ],
        limitations:
          "File-to-file compare is read-only and is available for supported markup documents. Public screenshots must use fixture files and avoid local absolute paths, source hunks, service URLs, and private document text.",
        related: [
          "Preview-based diff review",
          "CLI file compare",
          "Table and list diff review",
        ],
        screenshots: [
          screenshot(
            "file-compare-files.png",
            "File compare inputs",
            "Shows two local markup files prepared as compare inputs.",
            "Svard file tree showing file-to-file compare inputs",
          ),
          screenshot(
            "file-compare-context-menu.png",
            "File compare context menu",
            "Shows the file tree context menu entry used to start a file comparison.",
            "Svard file tree context menu with file compare action",
          ),
          screenshot(
            "file-compare-preview.png",
            "File compare preview diff",
            "Shows the preview diff created from two local markup files.",
            "Svard preview diff for two compared markup files",
          ),
        ],
      },
      cliFileCompare: {
        title: "CLI file compare",
        lead: "CLI file compare opens two documents from an external launch path into the same preview diff workspace.",
        whatThisFeatureIs:
          "Svard's file compare path is not limited to the file tree. A desktop launch path can pass two markup files and open the same preview diff workspace used for file-to-file compare.",
        whenToUse:
          "Use this when another tool, script, or shell workflow already knows the two documents to compare and Svard only needs to show the rendered review result.",
        workflow: [
          {
            title: "Pass two documents as arguments",
            body: "From a terminal or script, pass the two AsciiDoc or Markdown files you want to compare to Svard. Public examples use relative paths instead of local absolute paths. The app name is capitalized in desktop launch examples.",
            code: [
              "macOS:",
              "open -a Svard --args docs/product-guide-a.md docs/product-guide-b.md",
              "",
              "Windows:",
              ".\\Svard.exe docs\\product-guide-a.md docs\\product-guide-b.md",
            ].join("\n"),
            screenshot: screenshot(
              "file-compare-files.png",
              "File compare inputs",
              "Shows two local markup files prepared as compare inputs.",
              "Svard file tree showing file-to-file compare inputs",
            ),
          },
          {
            title: "Exactly two files become a comparison",
            body: "When exactly two supported document files are passed, Svard opens file-to-file compare instead of normal document tabs. One file opens as a document; three or more paths, or mixed file and folder inputs, open sequentially.",
          },
          {
            title: "Review the preview diff",
            body: "The comparison result appears as a preview diff so reviewers can inspect reader-visible changes instead of source lines only.",
            screenshot: screenshot(
              "file-compare-preview.png",
              "CLI compare result",
              "Shows the preview diff created from two local markup files.",
              "Svard preview diff for two compared markup files",
            ),
          },
        ],
        limitations:
          "This page stays focused on the two-file launch path. It does not document every CLI option, installer-specific executable location, shell-specific quoting, or automation workflow. Public screenshots and command examples avoid local absolute paths and source diff bodies.",
        related: [
          "File-to-file compare",
          "Preview-based diff review",
          "AsciiDoc and Markdown reading",
        ],
        screenshots: [
          screenshot(
            "file-compare-files.png",
            "File compare inputs",
            "Shows two local markup files prepared as compare inputs.",
            "Svard file tree showing file-to-file compare inputs",
          ),
          screenshot(
            "file-compare-preview.png",
            "CLI compare result",
            "Shows the preview diff created from two local markup files.",
            "Svard preview diff for two compared markup files",
          ),
        ],
      },
      tableListDiffReview: {
        title: "Table and list diff review",
        lead: "Table and list diff review helps readers inspect structured changes as rendered document content.",
        whatThisFeatureIs:
          "Rendered diff keeps list and table changes inside the preview context. For simple tables with high-confidence matches, Svard can also show changed and added cells in the table view.",
        whenToUse:
          "Use this when specification tables, comparison tables, or list items need review as reader-visible changes rather than source-line changes alone.",
        workflow: [
          {
            title: "Review structure in the preview",
            body: "List and table changes appear near the surrounding document content, so reviewers can inspect the reader-visible result.",
            screenshot: screenshot(
              "table-list-diff-review.png",
              "Rendered diff with table and list changes",
              "Shows a preview diff containing list and table changes.",
              "Svard preview diff showing table and list changes",
            ),
          },
          {
            title: "Inspect table cells when confidence is high",
            body: "For simple tables, the table view can show changed and added cells. Complex table structures fall back to broader review surfaces instead of forcing cell-level output.",
            screenshot: screenshot(
              "table-list-diff-table.png",
              "Table view cell diff",
              "Shows changed and added cells in the table view.",
              "Svard table view showing cell-level diff",
            ),
          },
        ],
        limitations:
          "Table view is for high-confidence simple tables. Spans, nested tables, and broad schema changes may fall back to wider block-level visibility. Public screenshots should use short public-safe cell text only.",
        related: [
          "Preview-based diff review",
          "File-to-file compare",
          "Change Navigator",
        ],
        screenshots: [
          screenshot(
            "table-list-diff-review.png",
            "Rendered diff with table and list changes",
            "Shows a preview diff containing list and table changes.",
            "Svard preview diff showing table and list changes",
          ),
          screenshot(
            "table-list-diff-table.png",
            "Table view cell diff",
            "Shows changed and added cells in the table view.",
            "Svard table view showing cell-level diff",
          ),
        ],
      },
      changeNavigator: {
        title: "Change Navigator",
        lead: "Change Navigator moves between changes in the preview diff without losing reading context.",
        whatThisFeatureIs:
          "In the preview diff workspace, Svard lets readers step through reader-visible changes. The navigator helps long documents avoid manual scanning by using the Previous / Next buttons or keyboard shortcuts to move between changes.",
        whenToUse:
          "Use this when a reviewed document is long or has multiple changes that should be checked in order.",
        supportMatrix: {
          title: "Navigation controls",
          lead: "After opening a preview diff, changes can be reached from the toolbar or the keyboard.",
          columns: ["Control", "Moves to", "Use it for"],
          rows: [
            [
              "Next",
              "Next change",
              "Reviewing changes from top to bottom.",
            ],
            [
              "Previous",
              "Previous change",
              "Returning to the change you just reviewed.",
            ],
            [
              "Alt+↓",
              "Next change",
              "Keyboard-driven review without leaving the document.",
            ],
            [
              "Alt+↑",
              "Previous change",
              "Keyboard-driven review when moving back.",
            ],
          ],
          note: "These are the default shortcuts. If keybindings are customized, follow the shortcut display shown in the app.",
        },
        workflow: [
          {
            title: "Open a preview diff",
            body: "Open the preview diff from the Changes list, Branch Diff, or file-to-file compare.",
            screenshot: screenshot(
              "source-control-open-diff.png",
              "Preview diff entry",
              "Shows a preview diff opened from the Changes list.",
              "Svard Changes list with a preview diff open",
            ),
          },
          {
            title: "Move between changes",
            body: "Use the Previous / Next buttons in the preview diff, or press Alt+↑ / Alt+↓, to move between changes while keeping the surrounding document visible.",
            screenshot: screenshot(
              "rendered-diff.png",
              "Change Navigator",
              "Shows change navigation inside the preview diff.",
              "Svard preview diff showing Change Navigator",
            ),
          },
        ],
        limitations:
          "Change Navigator is a read-only navigation aid. It does not accept, discard, or merge changes. When a diff falls back to broader block visibility, navigation follows that displayed unit. If shortcuts are customized, the in-app shortcut display is the source of truth.",
        related: [
          "Preview-based diff review",
          "Fallback visibility",
          "Table and list diff review",
        ],
        screenshots: [
          screenshot(
            "source-control-open-diff.png",
            "Preview diff entry",
            "Shows a preview diff opened from the Changes list.",
            "Svard Changes list with a preview diff open",
          ),
          screenshot(
            "rendered-diff.png",
            "Change Navigator",
            "Shows change navigation inside the preview diff.",
            "Svard preview diff showing Change Navigator",
          ),
        ],
      },
      fallbackVisibility: {
        title: "Fallback visibility",
        lead: "Fallback visibility explains when precise rendered diff markers fall back to broader blocks.",
        whatThisFeatureIs:
          "Svard uses fine-grained list and table visibility when confidence is high. When structure changes too much or matching is unreliable, it shows broader block-level changes instead of pretending precision.",
        whenToUse:
          "Use this when a diff appears broader than expected, or when a complex table or list change needs a clear explanation.",
        workflow: [
          {
            title: "Start with structured visibility",
            body: "Simple list and table changes can be reviewed in the structure of the rendered document.",
            screenshot: screenshot(
              "table-list-diff-review.png",
              "Structured diff visibility",
              "Shows a preview diff containing list and table changes.",
              "Svard preview diff showing table and list changes",
            ),
          },
          {
            title: "Read broader fallback blocks",
            body: "When reliable fine-grained matching is not possible, Svard uses broader blocks so the review surface does not overstate precision.",
            screenshot: screenshot(
              "rendered-diff.png",
              "Broader diff visibility",
              "Shows preview-based document changes in the diff workspace.",
              "Svard rendered diff review view",
            ),
          },
        ],
        limitations:
          "Fallback visibility does not guarantee every complex table, list, or diagram can be decomposed into precise markers. Public docs do not show source bodies or full diff hunks.",
        related: [
          "Table and list diff review",
          "Change Navigator",
          "Preview-based diff review",
        ],
        screenshots: [
          screenshot(
            "table-list-diff-review.png",
            "Structured diff visibility",
            "Shows a preview diff containing list and table changes.",
            "Svard preview diff showing table and list changes",
          ),
          screenshot(
            "rendered-diff.png",
            "Broader diff visibility",
            "Shows preview-based document changes in the diff workspace.",
            "Svard rendered diff review view",
          ),
        ],
      },
      changeReviewMode: {
        title: "Change Review Mode",
        lead: "Change Review Mode shows current local changes in the normal reader after it is enabled.",
        whatThisFeatureIs:
          "When the open document has current local changes, Svard can mark changed text, list items, and table areas near the rendered content. This is disabled by default and must be enabled from settings as Change Review Mode.",
        whenToUse:
          "Use this when you are rereading a document and want to notice current local changes without opening the full diff workspace.",
        workflow: [
          {
            title: "Enable it from settings",
            body: "Change Review Mode is off by default. Enable it in settings when you want markers in the normal reader.",
            screenshot: screenshot(
              "change-review-settings.png",
              "Change Review Mode setting",
              "Shows Change Review Mode in settings.",
              "Svard settings showing Change Review Mode",
            ),
          },
          {
            title: "See changes while reading",
            body: "After it is enabled, markers appear in the normal preview so the current local change can be reviewed in context.",
            screenshot: screenshot(
              "change-review-mode-markers.png",
              "Change Review Mode markers",
              "Shows current change markers in the normal reader.",
              "Svard reader showing current change markers",
            ),
          },
        ],
        limitations:
          "This feature is disabled by default. It is only a reading aid for current local changes and does not stage, commit, merge, or edit content. Complex structures may use broader markers instead of precise cell or item markers.",
        related: [
          "Table and list diff review",
          "Changes list",
          "Preview-based diff review",
        ],
        screenshots: [
          screenshot(
            "change-review-settings.png",
            "Change Review Mode setting",
            "Shows Change Review Mode in settings.",
            "Svard settings showing Change Review Mode",
          ),
          screenshot(
            "change-review-mode-markers.png",
            "Change Review Mode markers",
            "Shows current change markers in the normal reader.",
            "Svard reader showing current change markers",
          ),
        ],
      },
      listItemMarkers: {
        title: "List item markers",
        lead: "List item markers help readers notice changed list items in the normal reader.",
        whatThisFeatureIs:
          "When Change Review Mode is enabled, Svard can show markers near changed list items. It is a reading-context aid before opening a dedicated diff workspace.",
        whenToUse:
          "Use this when reviewing procedures, specifications, or notes where list items carry the important change.",
        workflow: [
          {
            title: "Enable Change Review Mode",
            body: "List item markers are not shown by default. Enable Change Review Mode in settings when you want markers in the normal reader.",
            screenshot: screenshot(
              "change-review-settings.png",
              "Change Review Mode setting",
              "Shows Change Review Mode in settings.",
              "Svard settings showing Change Review Mode",
            ),
          },
          {
            title: "Notice changed list items",
            body: "After enabling the mode, markers appear near changed content while you read the document.",
            screenshot: screenshot(
              "change-review-mode-markers.png",
              "List item markers",
              "Shows change markers in the normal reader.",
              "Svard reader showing change markers",
            ),
          },
        ],
        limitations:
          "List item markers are read-only review aids. This page does not cover staging, committing, or merging. Complex structures can fall back to broader markers.",
        related: [
          "Change Review Mode",
          "Table row and cell markers",
          "Table and list diff review",
        ],
        screenshots: [
          screenshot(
            "change-review-settings.png",
            "Change Review Mode setting",
            "Shows Change Review Mode in settings.",
            "Svard settings showing Change Review Mode",
          ),
          screenshot(
            "change-review-mode-markers.png",
            "List item markers",
            "Shows change markers in the normal reader.",
            "Svard reader showing change markers",
          ),
        ],
      },
      tableCellMarkers: {
        title: "Table row and cell markers",
        lead: "Table row and cell markers help readers inspect table changes when confidence is high.",
        whatThisFeatureIs:
          "Svard can highlight table changes at row or cell level when the table structure is simple enough. The normal reader can show change markers, and the preview diff table view can provide a more detailed table-focused view.",
        whenToUse:
          "Use this for specification tables, comparison tables, and settings tables where the changed row or cell matters to the reader.",
        workflow: [
          {
            title: "Notice table changes in the reader",
            body: "When Change Review Mode is enabled, table-adjacent change markers can appear in the normal reader.",
            screenshot: screenshot(
              "change-review-mode-markers.png",
              "Table change markers",
              "Shows change markers in the normal reader.",
              "Svard reader showing table-adjacent change markers",
            ),
          },
          {
            title: "Inspect cells in table view",
            body: "For supported simple tables, the table view shows changed and added cells.",
            screenshot: screenshot(
              "table-list-diff-table.png",
              "Table view cell diff",
              "Shows changed and added cells in table view.",
              "Svard table view showing cell-level diff",
            ),
          },
        ],
        limitations:
          "Cell-level visibility is limited to high-confidence simple tables. Merged cells, nested tables, and large structural replacements can fall back to broader block-level visibility.",
        related: [
          "Change Review Mode",
          "List item markers",
          "Table and list diff review",
        ],
        screenshots: [
          screenshot(
            "change-review-mode-markers.png",
            "Table change markers",
            "Shows change markers in the normal reader.",
            "Svard reader showing table-adjacent change markers",
          ),
          screenshot(
            "table-list-diff-table.png",
            "Table view cell diff",
            "Shows changed and added cells in table view.",
            "Svard table view showing cell-level diff",
          ),
        ],
      },
      sourceControlChanges: {
        title: "Changes list",
        lead: "The Changes list shows locally changed documents and opens them into preview-based review.",
        whatThisFeatureIs:
          "Source Control lists changed documents in the current folder. Supported documents can be opened from the list into the preview diff workspace for read-only review.",
        whenToUse:
          "Use this when you want to see which documents changed before choosing one to review as rendered output.",
        workflow: [
          {
            title: "List changed documents",
            body: "The Changes list identifies document review targets. This page treats it as an entry point, not as the full source-control surface.",
            screenshot: screenshot(
              "source-control-changes.png",
              "Changes list",
              "Shows changed documents in Source Control.",
              "Svard Source Control Changes list",
            ),
          },
          {
            title: "Open a preview diff",
            body: "Choose a supported document and inspect the reader-visible changes in the preview diff workspace.",
            screenshot: screenshot(
              "source-control-open-diff.png",
              "Preview diff opened from Changes",
              "Shows a preview diff opened from the Changes list.",
              "Svard preview diff opened from Source Control Changes",
            ),
          },
        ],
        limitations:
          "The Changes list is a read and review entry point. This page does not cover staging, committing, branch operations, history analysis, or the repository graph. Public screenshots should not include real repository names or local absolute paths.",
        related: [
          "Change Review Mode",
          "Preview-based diff review",
          "Branch Diff",
          "Repo Graph",
          "File History",
        ],
        screenshots: [
          screenshot(
            "source-control-changes.png",
            "Changes list",
            "Shows changed documents in Source Control.",
            "Svard Source Control Changes list",
          ),
          screenshot(
            "source-control-open-diff.png",
            "Preview diff opened from Changes",
            "Shows a preview diff opened from the Changes list.",
            "Svard preview diff opened from Source Control Changes",
          ),
        ],
      },
      branchDiff: {
        title: "Branch Diff",
        lead: "Branch Diff turns base...HEAD differences into read-only document review entry points.",
        whatThisFeatureIs:
          "Source Control Branch Diff lists documents that changed between the selected base branch and the current working branch. Supported documents can open directly into the preview diff workspace.",
        whenToUse:
          "Use this when you want to understand which documents changed on a review branch before opening rendered diffs.",
        workflow: [
          {
            title: "Review changed documents against a base branch",
            body: "Select a base branch in Branch Diff and scan the documents that changed. This page treats the view as a review entry point, not as a Git operation surface.",
            screenshot: screenshot(
              "source-control-branch-diff.png",
              "Branch Diff",
              "Shows documents changed between the base branch and the current branch.",
              "Svard Source Control showing Branch Diff",
            ),
          },
          {
            title: "Open the rendered diff",
            body: "Choose a supported document to inspect the reader-visible changes in the preview diff workspace.",
            screenshot: screenshot(
              "source-control-branch-diff-preview.png",
              "Preview diff opened from Branch Diff",
              "Shows a preview diff opened from Branch Diff.",
              "Svard preview diff opened from Branch Diff",
            ),
          },
        ],
        limitations:
          "Branch Diff is a read-only review entry point. This page does not cover staging, committing, checkout, fetch, or merge. Merge-target detection is only an optional assist when configured.",
        related: ["Changes list", "Repo Graph", "File History"],
        screenshots: [
          screenshot(
            "source-control-branch-diff.png",
            "Branch Diff",
            "Shows documents changed between the base branch and the current branch.",
            "Svard Source Control showing Branch Diff",
          ),
          screenshot(
            "source-control-branch-diff-preview.png",
            "Preview diff opened from Branch Diff",
            "Shows a preview diff opened from Branch Diff.",
            "Svard preview diff opened from Branch Diff",
          ),
        ],
      },
      repoGraph: {
        title: "Repo Graph",
        lead: "Repo Graph helps readers inspect repository-wide history before choosing what to review.",
        whatThisFeatureIs:
          "Source Control Repo Graph shows the flow of commits as a read-only review surface. It helps you understand the sequence of changes before opening document-level diffs.",
        whenToUse:
          "Use this when a folder has multiple recent changes and you want to decide where to begin review.",
        workflow: [
          {
            title: "Read the history overview",
            body: "Scan Repo Graph to understand the order and context of recent changes. This page focuses on reading history, not changing repository state.",
            screenshot: screenshot(
              "source-control-repo-graph.png",
              "Repo Graph",
              "Shows multiple commits in Repo Graph.",
              "Svard Source Control showing Repo Graph",
            ),
          },
        ],
        limitations:
          "Repo Graph is read-only. This page does not cover commit details, ref compare, checkout, merge, or other Git operations.",
        related: ["Changes list", "Branch Diff", "File History"],
        screenshots: [
          screenshot(
            "source-control-repo-graph.png",
            "Repo Graph",
            "Shows multiple commits in Repo Graph.",
            "Svard Source Control showing Repo Graph",
          ),
        ],
      },
      fileHistory: {
        title: "File History",
        lead: "File History narrows history review to the document you are reading.",
        whatThisFeatureIs:
          "Source Control File History shows history for the current document instead of the whole repository. It is an entry point for understanding how a specific document changed over time.",
        whenToUse:
          "Use this when you want to review past changes for the document you already have open.",
        workflow: [
          {
            title: "Inspect history for the current document",
            body: "Open File History to list changes related to the active document. From there, you can move into read-only diff review when needed.",
            screenshot: screenshot(
              "source-control-file-history.png",
              "File History",
              "Shows File History scoped to the current document.",
              "Svard Source Control showing File History",
            ),
          },
        ],
        limitations:
          "File History is read-only history review. This page does not cover restoring files, editing older versions, or checkout.",
        related: ["Changes list", "Branch Diff", "Repo Graph"],
        screenshots: [
          screenshot(
            "source-control-file-history.png",
            "File History",
            "Shows File History scoped to the current document.",
            "Svard Source Control showing File History",
          ),
        ],
      },
      commitDetailsRefCompare: {
        title: "Commit details and ref compare",
        lead: "Commit details and ref compare provide read-only context before opening document diffs.",
        whatThisFeatureIs:
          "Svard Source Control is a review entry point, not a place to run Git operations. Right-click a document in the Changes list to compare it with a branch, tag, or commit. Commit details and ref compare help readers understand change context before opening preview diffs.",
        whenToUse:
          "Use this when you need to understand which history or reference a review target belongs to before opening the relevant document diff.",
        workflow: [
          {
            title: "Open compare actions from the Changes list",
            body: "Right-click a document in Source Control Changes and choose Compare with Branch, Compare with Tag, or Compare with Commit.",
            screenshot: screenshot(
              "source-control-ref-context-menu.png",
              "Ref compare context menu",
              "Shows the right-click menu entry point for ref compare actions.",
              "Svard Source Control showing the ref compare context menu",
            ),
          },
          {
            title: "Review the comparison as a document",
            body: "After choosing the comparison target, review the result as a read-only preview diff.",
            screenshot: screenshot(
              "source-control-branch-diff-preview.png",
              "Ref compare preview diff",
              "Shows a preview diff opened from Branch Diff.",
              "Svard preview diff opened from Branch Diff",
            ),
          },
        ],
        limitations:
          "This page does not cover checkout, merge, fetch, push, or creating commits. Public docs avoid provider URLs, credentials, real repository names, and full diff hunks.",
        related: ["Branch Diff", "Repo Graph", "File History"],
        screenshots: [
          screenshot(
            "source-control-ref-context-menu.png",
            "Ref compare context menu",
            "Shows the right-click menu entry point for ref compare actions.",
            "Svard Source Control showing the ref compare context menu",
          ),
          screenshot(
            "source-control-branch-diff-preview.png",
            "Ref compare preview diff",
            "Shows a preview diff opened from Branch Diff.",
            "Svard preview diff opened from Branch Diff",
          ),
        ],
      },
      documentActions: {
        title: "Document actions",
        lead: "Document actions provide context-sensitive entry points from rendered document content.",
        whatThisFeatureIs:
          "Svard centers actions around the reader. Context actions appear from rendered content or nearby document surfaces so readers can continue from the thing they are looking at.",
        whenToUse:
          "Use this when you are reading a document and need to continue into a related compare, diagram, link, or copy action without switching to a separate manual surface.",
        workflow: [
          {
            title: "Start from rendered content",
            body: "Actions start from the displayed document, not from raw source text.",
            screenshot: screenshot(
              "reader-main.png",
              "Rendered document",
              "Shows the normal reader with document content visible.",
              "Svard reader showing rendered document content",
            ),
          },
          {
            title: "Open a representative action",
            body: "Context actions are shown only where they are useful. The public docs show the entry point without listing every menu item.",
            screenshot: screenshot(
              "file-compare-context-menu.png",
              "Context action entry",
              "Shows a representative context action entry in the file tree.",
              "Svard showing a context action entry",
            ),
          },
        ],
        limitations:
          "Document actions are reading and review aids. This page does not cover editing, pasted results, copied local path values, or the full action catalog. Full operation manuals remain outside this docs batch.",
        related: [
          "Link inspection and document actions",
          "Table copy actions",
          "Sidebar and tab actions",
        ],
        screenshots: [
          screenshot(
            "reader-main.png",
            "Rendered document",
            "Shows the normal reader with document content visible.",
            "Svard reader showing rendered document content",
          ),
          screenshot(
            "file-compare-context-menu.png",
            "Context action entry",
            "Shows a representative context action entry in the file tree.",
            "Svard showing a context action entry",
          ),
        ],
      },
      headingTocActions: {
        title: "Heading and Contents actions",
        lead: "Heading and Contents actions help readers understand location and move through long documents.",
        whatThisFeatureIs:
          "The Contents sidebar presents document headings as a navigable outline. Heading and Contents actions keep navigation tied to the rendered document structure.",
        whenToUse:
          "Use this when reading long specifications or guides and you need to confirm the current section or jump to another heading.",
        workflow: [
          {
            title: "Read the outline with the document",
            body: "The Contents sidebar and the rendered heading together show where the current section sits in the document.",
            screenshot: screenshot(
              "table-of-contents.png",
              "Contents and document",
              "Shows the Contents sidebar and document headings together.",
              "Svard Contents sidebar with rendered document headings",
            ),
          },
          {
            title: "Jump to a heading",
            body: "Selecting a Contents item moves the reader to the matching section while preserving document context.",
            screenshot: screenshot(
              "table-of-contents-jump.png",
              "Heading jump",
              "Shows navigation from a Contents item to a document heading.",
              "Svard Contents navigation to a heading",
            ),
          },
        ],
        limitations:
          "This page focuses on navigation and reference while reading. It does not cover heading-authoring guidance, every context menu item, or copied values.",
        related: [
          "Table of contents",
          "Quick Open",
          "Search result navigation",
        ],
        screenshots: [
          screenshot(
            "table-of-contents.png",
            "Contents and document",
            "Shows the Contents sidebar and document headings together.",
            "Svard Contents sidebar with rendered document headings",
          ),
          screenshot(
            "table-of-contents-jump.png",
            "Heading jump",
            "Shows navigation from a Contents item to a document heading.",
            "Svard Contents navigation to a heading",
          ),
        ],
      },
      tableCopyActions: {
        title: "Table copy actions",
        lead: "Table copy actions let readers right-click a rendered table and copy it in a useful format.",
        whatThisFeatureIs:
          "Svard is not a spreadsheet editor, but rendered tables have a context menu. Right-click a table to copy it as TSV, CSV, or a Markdown table. Tables with source reference metadata can also expose Copy Table Reference.",
        whenToUse:
          "Use this when reading specification or comparison tables and you need to move visible table content into a spreadsheet, review comment, or Markdown note.",
        supportMatrix: {
          title: "Copy formats",
          lead: "The right-click menu exposes formats for moving a rendered table into another workflow.",
          columns: ["Menu item", "Use it for", "Output model"],
          rows: [
            [
              "Copy as TSV",
              "Pasting into spreadsheet tools.",
              "Copies a tab-separated table.",
            ],
            [
              "Copy as CSV",
              "Passing the table to CSV-oriented tools or notes.",
              "Copies a comma-separated table.",
            ],
            [
              "Copy as Markdown Table",
              "Pasting into Markdown review comments or notes.",
              "Copies a Markdown table.",
            ],
            [
              "Copy Table Reference",
              "Sharing where the table came from without copying values.",
              "Shown only when reference metadata is available.",
            ],
          ],
          note: "The copy target is the rendered table. Public docs and screenshots do not expose full source text or local absolute paths.",
        },
        workflow: [
          {
            title: "Read the rendered table",
            body: "Tables are presented as reader-visible output rather than markup syntax.",
            screenshot: screenshot(
              "reading-markup-asciidoc.png",
              "Rendered table",
              "Shows a reader view containing rendered AsciiDoc table content.",
              "Svard reader showing a document with a table",
            ),
          },
          {
            title: "Right-click the table",
            body: "Right-click a rendered table cell and choose Copy as TSV, Copy as CSV, or Copy as Markdown Table depending on where you will paste the result.",
            screenshot: screenshot(
              "table-copy-context-menu.png",
              "Table context menu",
              "Shows the table context menu with copy format actions.",
              "Svard table context menu showing copy actions",
            ),
          },
        ],
        limitations:
          "Table copy actions are helpers for rendered content. They do not promise table editing, calculation, or exact reconstruction of complex table structures. Copy output follows the visible table and may vary with selection and table structure.",
        related: [
          "Table and list diff review",
          "AsciiDoc and Markdown reading",
          "Supported diagrams",
        ],
      },
      linkDocumentActions: {
        title: "Link inspection and document actions",
        lead: "Link inspection helps readers check a target before opening it.",
        whatThisFeatureIs:
          "Svard shows link destinations and local document previews when readers hover document links. The right-click menu can then open the link, open a local document in a new window, open it in an editor, or copy the target.",
        whenToUse:
          "Use this before opening a reference so you can tell whether it points to a heading in the same document, another local document, or an external URL.",
        supportMatrix: {
          title: "What you can inspect",
          lead: "Link actions help readers understand a reference before following it.",
          columns: ["Action", "What it shows", "Notes"],
          rows: [
            [
              "Hover a link",
              "Shows the link destination.",
              "This helps distinguish same-document links, local document links, and external links.",
            ],
            [
              "Hover a local document link",
              "Shows a preview of the target document or heading.",
              "If preview is unavailable, Svard shows a degraded preview message.",
            ],
            [
              "Right-click a local document link",
              "Opens the link action menu.",
              "Open Document, Open Link in New Window, Open in Editor, and Copy Path can be available.",
            ],
            [
              "Right-click an external link",
              "Opens or copies the external URL.",
              "External links remain subject to safety confirmation.",
            ],
          ],
          note: "Public docs do not expose local absolute paths, private link values, or copied target values.",
        },
        workflow: [
          {
            title: "Hover the link",
            body: "Hover a document link to inspect its destination and preview before opening it.",
            screenshot: screenshot(
              "link-hover-preview.png",
              "Link destination preview",
              "Shows hovering a document link to inspect its destination and preview.",
              "Svard showing a link destination preview while hovering a document link",
            ),
          },
          {
            title: "Choose an action from the right-click menu",
            body: "Right-click the link and choose whether to open it, open it in another window, open it in an editor, or copy its target.",
            screenshot: screenshot(
              "link-context-menu.png",
              "Link context menu",
              "Shows the right-click menu for a document link.",
              "Svard showing a document link context menu",
            ),
          },
        ],
        limitations:
          "Link actions support inspection and movement while reading. This page does not cover editing linked documents, arbitrary external-service workflows, exposing private paths, or publishing copied target values. External links follow a separate safety confirmation path.",
        related: [
          "Includes and local assets",
          "Local-first privacy model",
          "Document actions",
        ],
      },
      sidebarTabActions: {
        title: "Sidebar and tab actions",
        lead: "Sidebar and tab actions organize a reading session with multiple documents open.",
        whatThisFeatureIs:
          "Svard uses the file tree, Open Files, bookmarks, and tabs to help readers move between documents. These surfaces organize a reading workspace rather than a project-management system.",
        whenToUse:
          "Use this when comparing several specifications, keeping a frequently read location nearby, or cleaning up an active reading session.",
        workflow: [
          {
            title: "Review open documents",
            body: "Open Files and tabs show the documents currently involved in the reading session.",
            screenshot: screenshot(
              "tabs-open-files.png",
              "Open files",
              "Shows the file tree and Open Files together.",
              "Svard file tree and Open Files",
            ),
          },
          {
            title: "Keep frequent places nearby",
            body: "Bookmarks keep important folders and documents accessible for repeated reading.",
            screenshot: screenshot(
              "bookmarks.png",
              "Bookmarks",
              "Shows folders and documents in the Bookmarks sidebar.",
              "Svard Bookmarks sidebar",
            ),
          },
        ],
        limitations:
          "Sidebar and tab actions focus on organizing reading sessions. Sync, sharing, project management, full closed-tab history, and every context action are outside this page.",
        related: ["Tabs and Open Files", "Bookmarks", "Split View"],
        screenshots: [
          screenshot(
            "tabs-open-files.png",
            "Open files",
            "Shows the file tree and Open Files together.",
            "Svard file tree and Open Files",
          ),
          screenshot(
            "bookmarks.png",
            "Bookmarks",
            "Shows folders and documents in the Bookmarks sidebar.",
            "Svard Bookmarks sidebar",
          ),
        ],
      },
      generalSettings: {
        title: "General settings",
        lead: "General settings adjust document display, zoom, and reader-side review aids.",
        whatThisFeatureIs:
          "General settings collect the app theme, AsciiDoc theme, zoom, mouse-wheel zoom, and Change Review Mode controls. They change how documents are read in Svard; they do not rewrite the document file.",
        whenToUse:
          "Use this when text feels too small, the app should use a darker theme, AsciiDoc styling needs a different look, or change markers should appear while reading.",
        supportMatrix: {
          title: "Available settings",
          lead: "General covers reader-facing display and review-aid settings.",
          columns: ["Setting", "What it changes", "Default"],
          rows: [
            ["Theme", "Switches the app between Light and Dark.", "Light"],
            [
              "AsciiDoc theme",
              "Changes AsciiDoc document styling between Antora and Asciidoctor.",
              "Antora",
            ],
            [
              "Zoom",
              "Adjusts the reader zoom level from 80% to 140%.",
              "100%",
            ],
            [
              "Zoom with mouse wheel",
              "Allows Command + scroll on macOS or Ctrl + scroll on Windows and Linux to change zoom.",
              "Off",
            ],
            [
              "Change Review Mode",
              "Shows working-tree change markers directly in the reader.",
              "Off",
            ],
          ],
          note: "Zen Mode detail, diagrams, Kroki, security, and keybindings are handled in separate Preferences sections.",
        },
        workflow: [
          {
            title: "Open General and adjust the reader",
            body: "Preferences General shows the app theme, AsciiDoc theme, zoom, mouse-wheel zoom, and Change Review Mode controls in one place.",
            screenshot: screenshot(
              "themes-zoom-preferences.png",
              "General settings",
              "Shows display and review-aid controls in Preferences General.",
              "Svard Preferences General",
            ),
          },
        ],
        limitations:
          "This page focuses on reader display and review aids. It does not document storage format, internal keys, experimental options, or external service settings. The app UI is the source of truth for current labels.",
        related: ["Themes and zoom", "Change Review Mode", "Keybindings"],
      },
      diagramSettings: {
        title: "Diagram settings",
        lead: "Diagram settings tune diagram loading and inspection around local rendering first.",
        whatThisFeatureIs:
          "Svard treats Mermaid, PlantUML, and Graphviz local rendering as the primary path. Diagram settings explain reader-visible loading behavior for documents with diagrams.",
        whenToUse:
          "Use this when reading long diagram-heavy documents or when you need to understand diagram loading status.",
        workflow: [
          {
            title: "Review diagram loading settings",
            body: "Preferences Diagrams shows controls related to diagram loading behavior.",
            screenshot: screenshot(
              "diagram-loading-cache.png",
              "Diagram settings",
              "Shows fast diagram loading settings.",
              "Svard diagram settings screen",
            ),
          },
          {
            title: "Check diagram status",
            body: "Rendered diagrams can be inspected from the Diagrams tab. This page stays focused on reader-visible behavior instead of implementation details.",
            screenshot: screenshot(
              "diagram-inspector.png",
              "Diagram status",
              "Shows multiple diagram entries and status in the Diagrams tab.",
              "Svard Diagrams tab",
            ),
          },
        ],
        limitations:
          "Diagram settings do not document cache internals or storage locations. Public artifacts should not include sensitive information.",
        related: [
          "Local diagram rendering",
          "Diagram Inspector",
          "Fast diagram loading and cache",
        ],
        screenshots: [
          screenshot(
            "diagram-loading-cache.png",
            "Diagram settings",
            "Shows fast diagram loading settings.",
            "Svard diagram settings screen",
          ),
          screenshot(
            "diagram-inspector.png",
            "Diagram status",
            "Shows multiple diagram entries and status in the Diagrams tab.",
            "Svard Diagrams tab",
          ),
        ],
      },
      krokiSettings: {
        title: "Kroki settings",
        lead: "Kroki settings enable external fallback only when the user explicitly opts in.",
        whatThisFeatureIs:
          "Svard keeps local rendering as the primary path. Kroki is an assist path for unsupported, compatibility, or explicitly configured cases.",
        whenToUse:
          "Use this before enabling external fallback for diagrams that cannot be handled locally.",
        workflow: [
          {
            title: "Confirm explicit fallback",
            body: "Kroki is not the silent default. It is an explicit assist path.",
            screenshot: screenshot(
              "kroki-fallback.png",
              "Kroki fallback",
              "Shows explicit Kroki fallback settings.",
              "Svard Kroki fallback settings",
            ),
          },
          {
            title: "Keep the local-first boundary visible",
            body: "Public docs explain the boundary without showing concrete connection values or credentials.",
            screenshot: screenshot(
              "privacy-boundary.png",
              "Local-first boundary",
              "Shows settings that explain information kept out of public artifacts.",
              "Svard privacy boundary screen",
            ),
          },
        ],
        limitations:
          "Kroki settings are an advanced assist path. This page does not promise full compatibility for every diagram, external service availability, or concrete configuration values.",
        related: [
          "Explicit Kroki fallback",
          "Local diagram rendering",
          "Security settings",
        ],
        screenshots: [
          screenshot(
            "kroki-fallback.png",
            "Kroki fallback",
            "Shows explicit Kroki fallback settings.",
            "Svard Kroki fallback settings",
          ),
          screenshot(
            "privacy-boundary.png",
            "Local-first boundary",
            "Shows settings that explain information kept out of public artifacts.",
            "Svard privacy boundary screen",
          ),
        ],
      },
      securitySettings: {
        title: "Security settings",
        lead: "Security settings help readers understand external references and public-artifact boundaries.",
        whatThisFeatureIs:
          "Svard is built around safely reading local documents. Security settings explain boundaries for external images, local files, and information that should not appear in public artifacts.",
        whenToUse:
          "Use this before reading documents with external references, or before preparing screenshots and logs for public docs.",
        workflow: [
          {
            title: "Check the boundary",
            body: "The settings and policy language make public-artifact boundaries explicit.",
            screenshot: screenshot(
              "privacy-boundary.png",
              "Security boundary",
              "Shows settings that explain information kept out of public artifacts.",
              "Svard security boundary screen",
            ),
          },
          {
            title: "Open local documents",
            body: "The primary path is reading documents from an opened local folder.",
            screenshot: screenshot(
              "files.png",
              "Local documents",
              "Shows local documents in the file tree.",
              "Svard file tree showing local documents",
            ),
          },
        ],
        limitations:
          "This is a public-site overview. It does not include full sandbox specifications, threat models, audit log contracts, or secret values.",
        related: [
          "Local-first privacy model",
          "Kroki settings",
          "Network and provider settings",
        ],
        screenshots: [
          screenshot(
            "privacy-boundary.png",
            "Security boundary",
            "Shows settings that explain information kept out of public artifacts.",
            "Svard security boundary screen",
          ),
          screenshot(
            "files.png",
            "Local documents",
            "Shows local documents in the file tree.",
            "Svard file tree showing local documents",
          ),
        ],
      },
      keybindings: {
        title: "Keybindings",
        lead: "Keybindings let you review and adjust keyboard shortcuts for frequent actions.",
        whatThisFeatureIs:
          "Svard lets common search, navigation, layout, and settings actions use keyboard shortcuts. The current preset is Native OS only, using Cmd-oriented defaults on macOS and Ctrl-oriented defaults on Windows and Linux.",
        whenToUse:
          "Use this when Quick Open, search, or tab switching becomes frequent enough that you want to check defaults or adjust individual assignments.",
        supportMatrix: {
          title: "What you can configure",
          lead: "The Keybindings section covers keyboard shortcuts only. Mouse gestures are configured separately.",
          columns: ["Item", "What it does", "Current state"],
          rows: [
            ["Preset", "Selects the shortcut preset.", "Native OS only"],
            [
              "Shortcut assignments",
              "Search actions and use Record / Clear to adjust individual shortcuts.",
              "Editable",
            ],
            [
              "Reset to defaults",
              "Restores edited assignments to their defaults.",
              "Native OS defaults",
            ],
            [
              "Search",
              "Filters by action name, command ID, or current shortcut.",
              "Available",
            ],
          ],
          note: "Mouse Gestures are not part of Keybindings. Right-button drag gestures are handled in the Mouse Gestures section.",
        },
        workflow: [
          {
            title: "Open Keybindings",
            body: "Preferences Keybindings shows the current preset and shortcut assignment table.",
            screenshot: screenshot(
              "keybindings.png",
              "Keybindings",
              "Shows the Keybindings settings table in Preferences.",
              "Svard Keybindings settings screen",
            ),
          },
        ],
        limitations:
          "The current preset is Native OS only. Vim / Emacs-style presets are not documented as available public-site features. Shortcut labels can vary by operating system, keyboard, and user settings.",
        related: ["Quick Open", "Command palette", "Mouse Gestures"],
      },
      mouseGestures: {
        title: "Mouse Gestures",
        lead: "Mouse Gestures run navigation and tab actions with right-button drag patterns.",
        whatThisFeatureIs:
          "Svard can map right-button drag directions in the viewer to navigation and tab actions. Mouse Gestures are disabled by default and must be enabled explicitly from Preferences.",
        whenToUse:
          "Use this when you repeatedly go back, go forward, jump through a document, switch tabs, or open Quick Open with mouse-centered navigation.",
        supportMatrix: {
          title: "What you can configure",
          lead: "Mouse Gestures are separate from keyboard shortcuts.",
          columns: ["Item", "What it does", "Default"],
          rows: [
            [
              "Enable right-button drag gestures",
              "Turns right-button drag gestures on.",
              "Off",
            ],
            ["Show gesture trail", "Shows the drag trail while gesturing.", "On"],
            [
              "Minimum distance",
              "Sets how far the pointer must move before a gesture direction is recognized.",
              "32px",
            ],
            [
              "Gesture assignments",
              "Maps direction patterns to actions and lets users Record / Clear assignments.",
              "Default mappings",
            ],
          ],
          note: "Gestures run only in the viewer and are disabled while Preferences or Quick Open is open.",
        },
        workflow: [
          {
            title: "Enable Mouse Gestures",
            body: "Preferences Mouse Gestures controls right-button drag gestures, trail display, and minimum distance.",
            screenshot: screenshot(
              "mouse-gestures.png",
              "Mouse Gestures settings",
              "Shows right-button drag gesture settings in Preferences.",
              "Svard Mouse Gestures settings screen",
            ),
          },
          {
            title: "Adjust gesture assignments",
            body: "Gesture assignments map direction patterns to actions such as back, forward, tab navigation, and Quick Open.",
            screenshot: screenshot(
              "mouse-gestures-record.png",
              "Gesture assignments",
              "Shows adjusting gesture assignments with Record / Clear.",
              "Svard Mouse Gestures assignment settings screen",
            ),
          },
        ],
        limitations:
          "Mouse Gestures are disabled by default. They can conflict with context menus or OS/browser habits, so they remain an explicit opt-in setting for users who want mouse-centered navigation.",
        related: ["Keybindings", "Tabs and Open Files", "Quick Open"],
      },
      networkProviderSettings: {
        title: "Network settings",
        lead: "Network settings configure the HTTP proxy used by explicit external access.",
        whatThisFeatureIs:
          "Normal Svard usage is local document reading. Network configures the HTTP proxy used when explicit external fallback or provider access is enabled. PR / MR Providers are handled in a separate Preferences tab.",
        whenToUse:
          "Use this in environments that require an internal proxy before explicit external features such as Kroki or PR / MR provider access can connect.",
        supportMatrix: {
          title: "What you can configure",
          lead: "Network is a connection-path setting. It does not enable external features by itself.",
          columns: ["Item", "What it does", "Default"],
          rows: [
            ["HTTP proxy", "Chooses whether to use a proxy.", "Disabled"],
            [
              "Proxy URL",
              "Sets the proxy address when Custom is selected.",
              "Unset",
            ],
          ],
          note: "Provider Host URL, credentials, and PR / MR target detection are handled in PR / MR Providers.",
        },
        workflow: [
          {
            title: "Open Network",
            body: "Preferences > Network shows HTTP proxy mode and proxy address controls.",
            screenshot: screenshot(
              "network-settings.png",
              "Network settings",
              "Shows HTTP proxy settings in Preferences Network.",
              "Svard Network settings",
            ),
          },
        ],
        limitations:
          "Network is a connection-path setting. It does not silently enable external fallback or provider integration. Public docs do not show concrete connection values or credentials.",
        related: [
          "PR / MR Providers",
          "Kroki settings",
          "Explicit Kroki fallback",
        ],
        screenshots: [
          screenshot(
            "network-settings.png",
            "Network settings",
            "Shows HTTP proxy settings in Preferences Network.",
            "Svard Network settings",
          ),
        ],
      },
      prMrProviders: {
        title: "PR / MR Providers",
        lead: "PR / MR Providers configure target branch detection for Branch Diff.",
        whatThisFeatureIs:
          "PR / MR Providers manage GitHub and GitLab connection settings. They help Source Control > Branch Diff offer PR target or MR target candidates. They are not required for normal local reading or local diff review.",
        whenToUse:
          "Use this when you want Branch Diff to detect the Pull Request or Merge Request target branch instead of choosing the base manually.",
        supportMatrix: {
          title: "What you can configure",
          lead: "GitHub and GitLab use the same configuration shape.",
          columns: ["Item", "What it does", "Handling"],
          rows: [
            ["Host URL", "Sets the provider host to connect to.", "Value hidden in public docs"],
            [
              "API token",
              "Stores credentials required for private repositories or API access.",
              "Stored in the OS credential store",
            ],
            [
              "Enable provider",
              "Allows Branch Diff to use the provider for PR target or MR target detection.",
              "Explicit opt-in",
            ],
            [
              "Test connection",
              "Checks the saved credentials against the provider.",
              "Available after storing credentials",
            ],
          ],
          note: "Credentials are not saved in app config. Public docs and screenshots do not show real values.",
        },
        workflow: [
          {
            title: "Open PR / MR Providers",
            body: "Preferences > PR / MR Providers shows GitHub and GitLab provider settings.",
            screenshot: screenshot(
              "pr-mr-providers.png",
              "PR / MR Providers",
              "Shows provider settings in Preferences PR / MR Providers.",
              "Svard PR / MR Providers settings",
            ),
          },
        ],
        limitations:
          "PR / MR Providers only assist Branch Diff target detection. This page does not cover staging, committing, merging, or provider-side review workflows. Public docs do not include real credentials or connection values.",
        related: [
          "Branch Diff",
          "Network settings",
          "Changes list",
        ],
        screenshots: [
          screenshot(
            "pr-mr-providers.png",
            "PR / MR Providers",
            "Shows provider settings in Preferences PR / MR Providers.",
            "Svard PR / MR Providers settings",
          ),
        ],
      },
      supportedDiagrams: {
        title: "Supported diagrams",
        lead: "Supported diagrams shows the current diagram support matrix and fallback paths.",
        whatThisFeatureIs:
          "Svard renders diagrams inside documents with local rendering first. Support differs by diagram family, and assist paths are used only when the user explicitly configures them.",
        whenToUse:
          "Use this when you want to understand which path renders each diagram type and where external fallback starts.",
        supportMatrix: {
          title: "Current support matrix",
          lead: "The table separates the public Docs promise into primary rendering paths and explicit assist paths.",
          columns: ["Diagram", "Input", "Primary path", "Assist path", "Notes"],
          rows: [
            [
              "Mermaid",
              "Markdown fenced code blocks and AsciiDoc diagram blocks",
              "Local rendering",
              "Explicit Kroki fallback",
              "Complex diagrams can still render differently from other tools.",
            ],
            [
              "PlantUML",
              "Markdown plantuml / puml blocks and AsciiDoc PlantUML blocks",
              "Local rendering",
              "External PlantUML fallback with a configured Native PlantUML executable, or explicit Kroki fallback",
              "External PlantUML runs only after the user installs and configures the binary.",
            ],
            [
              "Graphviz / DOT",
              "Markdown graphviz / dot blocks and AsciiDoc Graphviz blocks",
              "Local rendering",
              "Explicit Kroki fallback",
              "DOT is treated as Graphviz when fallback is used.",
            ],
            [
              "Kroki-supported diagrams",
              "blockdiag, seqdiag, actdiag, nwdiag, packetdiag, rackdiag, and C4-PlantUML",
              "Not a local primary path",
              "Kroki after user configuration",
              "Svard does not silently send diagrams to a public service.",
            ],
          ],
          note: "Public artifacts should not include sensitive information. The detailed boundary is covered by the local-first privacy model and security settings.",
        },
        workflow: [
          {
            title: "Inspect diagram status",
            body: "Use the Diagrams tab to review diagram entries, renderer names, and rendering status in one place.",
            screenshot: screenshot(
              "diagram-inspector.png",
              "Diagram list",
              "Shows multiple diagrams and their status in the Diagrams tab.",
              "Svard Diagrams tab showing diagram entries",
            ),
          },
          {
            title: "Open a larger preview",
            body: "Open Preview lets you inspect diagrams that are too small to read comfortably inside the document body.",
            screenshot: screenshot(
              "diagram-preview.png",
              "Diagram preview",
              "Shows a diagram opened in the preview panel.",
              "Svard diagram preview",
            ),
          },
        ],
        limitations:
          "External fallback is only an explicit assist path. Svard does not promise full compatibility for every complex diagram.",
        related: [
          "Local diagram rendering",
          "Diagram Inspector",
          "Explicit Kroki fallback",
          "External PlantUML fallback",
        ],
        screenshots: [
          screenshot(
            "diagram-inspector.png",
            "Diagram list",
            "Shows multiple diagrams and their status in the Diagrams tab.",
            "Svard Diagrams tab showing diagram entries",
          ),
          screenshot(
            "diagram-preview.png",
            "Diagram preview",
            "Shows a diagram opened in the preview panel.",
            "Svard diagram preview",
          ),
        ],
      },
      commandPalette: {
        title: "Command palette",
        lead: "Command palette is the command-running mode inside Quick Open.",
        whatThisFeatureIs:
          "In Svard, typing > in Quick Open switches the candidate list from documents and headings to commands. It lets you find actions such as view switching, preferences, search, and diff review by name instead of browsing menu levels.",
        whenToUse:
          "Use this when you know part of the action name but do not want to search through the menus. Use the regular Quick Open modes for documents, headings, and source-line jumps.",
        workflow: [
          {
            title: "Open Quick Open",
            body: "Open the input from File > Quick Open... or the assigned keyboard shortcut.",
          },
          {
            title: "Use > for command candidates",
            body: "Type > at the start of the input to switch the list to commands. Continue typing part of an action name, then choose the command to run.",
            screenshot: screenshot(
              "command-palette.png",
              "Command candidates",
              "Shows Quick Open switched to command candidates.",
              "Svard command candidate list",
            ),
          },
        ],
        limitations:
          "The command palette is the command-running mode of Quick Open. This page covers that command mode only; document navigation, heading jumps, and source-line jumps are covered on the Quick Open page. Available commands and labels can vary by operating system and settings.",
        related: ["Quick Open", "Tabs and Open Files", "Keybindings"],
        screenshots: [
          screenshot(
            "command-palette.png",
            "Command candidates",
            "Shows Quick Open switched to command candidates.",
            "Svard command candidate list",
          ),
        ],
      },
    },
  },
  download: {
    eyebrow: "Download",
    heading: "Download Svard from GitHub Releases.",
    lead: "Use GitHub Releases as the official source for installers, release notes, and checksums. Review the platform notes before opening unsigned builds.",
    resources: {
      heading: "Download and verification",
      items: [
        {
          title: "GitHub Releases",
          body: "Download the latest macOS and Windows artifacts from the official GitHub Releases page.",
          state: "Official",
          href: releasesUrl,
        },
        {
          title: "Changelog",
          body: "Review user-visible changes and release notes before updating.",
          state: "Available",
          href: changelogUrl,
        },
        {
          title: "System requirements",
          body: "List supported OS, CPU, and memory requirements in a short pre-release form.",
          state: "Recommended",
          details: [
            "macOS: Apple Silicon (M1 or later)",
            "Windows: x86_64",
            "Memory: 4 GB or more, 8 GB or more recommended",
          ],
        },
        {
          title: "Distribution notes",
          body: "Document supported platforms and current distribution status before use.",
          state: "Pending",
          details: [
            "Linux is not supported at this time",
            "macOS and Windows builds are planned as unsigned builds",
            "Performance and Git reference resolution may be limited when using WSL environments or files located inside WSL because file watching and I/O can be slower across that boundary.",
          ],
        },
        {
          title: "Repository / Issues",
          body: "Open the public repository or report issues from GitHub.",
          state: "Available",
          href: issuesUrl,
        },
        {
          title: "Security / signing",
          body: "Until code signing and distribution channels are decided, this page treats builds as unsigned and documents the required caution.",
          state: "Pending",
          details: [
            "macOS and Windows builds are planned as unsigned builds",
            "Only allow artifacts obtained from the official release",
          ],
        },
      ],
    },
    platformSupport: {
      heading: "Platform support",
      rows: [
        {
          platform: "macOS",
          status: "Supported",
          command: "xattr -dr com.apple.quarantine /Applications/Svard.app",
          note: "Run this only after confirming that the app came from the official release. Control-click Open in Finder or System Settings approval can also be used.",
        },
        {
          platform: "Windows",
          status: "Supported",
          command: "Unblock-File -Path .\\Svard.exe",
          note: "Run this in PowerShell for the downloaded executable. If SmartScreen appears, use More info and then Run anyway.",
        },
        {
          platform: "Linux",
          status: "Unsupported",
          command: "None",
          note: "Linux artifacts and launch instructions are not provided at this time.",
        },
      ],
    },
  },
};

import { screenshot } from './screenshots';

export const site = {
  locale: 'en',
  title: 'Svard',
  description: 'A desktop viewer for reading AsciiDoc and Markdown.',
  nav: {
    top: 'Top',
    features: 'Features',
    download: 'Download',
    languageLabel: 'Japanese',
    languageHref: '/ja/',
  },
  footer: {
    summary: 'Svard is a desktop viewer for reading, searching, and comparing local technical documents.',
    github: 'GitHub TBD',
    release: 'Release TBD',
  },
  top: {
    eyebrow: 'Local-first document viewer',
    heading: 'Svard',
    lead: 'A desktop viewer for reading AsciiDoc and Markdown.',
    body: 'Open local technical documents safely, search the current file or workspace, review preview-based diffs, and handle diagrams around a reader-focused workflow.',
    primaryLink: { label: 'Download', href: '/en/download/' },
    secondaryLink: { label: 'Features', href: '/en/features/' },
    screenshot: {
      ...screenshot('hero-plantuml.png', 'PlantUML diagram', 'A real screenshot is not ready yet. This space should only use a synthetic fixture document or a public sample document.', 'Svard showing a PlantUML Alice to Bob sequence diagram'),
    },
    screenshotGallery: [
      { ...screenshot('reader-main.png', 'Main window screenshot', 'Place the main window after opening a document.', 'Svard showing the Product Guide document') },
      { ...screenshot('search.png', 'Search screenshot', 'Place current-file search or workspace search here.', 'Svard showing document search') },
      { ...screenshot('rendered-diff.png', 'Preview-based diff review', 'Place the preview-based diff workspace here.', 'Svard showing preview-based diff review') },
    ],
    highlights: [
      { title: 'Read AsciiDoc / Markdown', body: 'Designed as a viewer for technical documents, not as an editing tool.' },
      { title: 'Separate search scopes', body: 'Search the current document or the full workspace without breaking reading flow.' },
      { title: 'Review preview-based diffs', body: 'Check visible preview changes, not only source line diffs.' },
      { title: 'Render diagrams locally', body: 'Mermaid, PlantUML, and Graphviz use local rendering as the primary path.' },
      { title: 'Use browser-like navigation', body: 'Move between documents with tabs, back and forward navigation, bookmarks, and mouse gestures.' },
      { title: 'Review Git changes', body: 'Review Git changes and differences from GitHub or GitLab merge targets in the preview.' },
    ],
    privacy: {
      title: 'Local-first boundary',
      body: 'Svard assumes local files. Kroki is treated only as a fallback for unsupported, fully compatible, or explicitly configured cases. It is not an implicit public-service default.',
    },
    diff: {
      title: 'Preview-based diff review',
      body: 'Git and file-to-file comparison are organized around reviewing document changes in the preview, not only around line-based source diffs.',
    },
    download: {
      title: 'Download',
      body: 'Platform status, platform-specific notes, and known limitations are collected on the Download page.',
      status: 'Coming soon',
    },
    faq: [
      { question: 'Is Svard an editor?', answer: 'No. Svard focuses on reading, navigation, and comparison as a desktop viewer.' },
      { question: 'Does Svard use public Kroki by default?', answer: 'No. Public Kroki is not an implicit default. Fallback requires explicit user configuration.' },
      { question: 'Do I need to install the Git command?', answer: 'No. Git support is integrated into Svard, so you do not need to install a separate Git command just to review diffs.' },
    ],
  },
  features: {
    eyebrow: 'Features',
    heading: 'Capabilities for reading, searching, and comparing.',
    lead: 'Svard is not an editor or IDE. It is a local-first desktop viewer for technical documents.',
    screenshot: {
      ...screenshot('reader-main.png', 'Reader view', 'Feature screenshots should be prepared with public sample documents before publication.', 'Svard document reader view'),
    },
    sections: [
      { title: 'AsciiDoc / Markdown reading', body: 'Open AsciiDoc and Markdown technical documents as a viewer. Svard does not rewrite source for viewer convenience.', screenshot: screenshot('reader-main.png', 'Reading screenshot', 'Place the document reading state here.', 'Svard reading view') },
      { title: 'Files', body: 'Open a local folder and choose AsciiDoc or Markdown documents from the file tree. Git change status is visible directly in the tree.', screenshot: screenshot('files.png', 'Files screenshot', 'Place the file tree and Git status state here.', 'Svard Files view') },
      { title: 'Current File / All Files search', body: 'Separate searching within the current document from searching across the workspace.', screenshot: screenshot('search.png', 'Search screenshot', 'Place the search UI and results here.', 'Svard search view') },
      { title: 'Preview-based diff review', body: 'Review Git changes and differences from GitHub or GitLab merge targets in the preview, not only as source line diffs.', screenshot: screenshot('rendered-diff.png', 'Preview diff screenshot', 'Place the preview-based diff view here.', 'Svard preview diff view') },
      { title: 'Source Control', body: 'Use Git changes, branch diffs, and file history as entry points for document review in the same workspace.', screenshot: screenshot('source-control.png', 'Source Control screenshot', 'Place the Source Control review state here.', 'Svard Source Control view') },
      { title: 'Local diagram rendering', body: 'Mermaid, PlantUML, and Graphviz use local rendering as the primary path.', screenshot: screenshot('hero-plantuml.png', 'PlantUML diagram', 'Place a locally rendered diagram here.', 'Svard showing a PlantUML diagram') },
      { title: 'Explicit Kroki fallback', body: 'Kroki is only a fallback for unsupported, fully compatible, or explicitly configured cases.', screenshot: screenshot('kroki-fallback.png', 'Kroki preference screenshot', 'Place a preference screen that shows explicit configuration.', 'Svard Kroki fallback preference view') },
      { title: 'Bookmark management', body: 'Bookmark frequently used folders and documents, then use them as stable entry points for reading.', screenshot: screenshot('navigation.png', 'Bookmarks screenshot', 'Place the bookmark management state for folders and documents here.', 'Svard bookmark management view') },
      { title: 'Privacy boundary', body: 'Avoid casually exposing diagram source, full document text, private paths, or endpoint URLs to services or logs.', screenshot: screenshot('privacy-boundary.png', 'Privacy screenshot', 'Place a preference or state view that explains the privacy boundary.', 'Svard privacy boundary preference view') },
    ],
  },
  download: {
    eyebrow: 'Download',
    heading: 'Public release is in preparation.',
    lead: 'This page keeps only the practical information needed to start using Svard. Undecided links are not presented as active download buttons.',
    status: { label: 'Release status', value: 'Coming soon' },
    resources: {
      heading: 'Download and verification',
      items: [
        {
          title: 'GitHub Releases',
          body: 'After public release, this will link to the latest artifacts, OS-specific assets, release notes, and SHA-256 checksums.',
          state: 'URL TBD',
        },
        {
          title: 'Changelog',
          body: 'This will link to the CHANGELOG or release notes for checking what changed in each public release.',
          state: 'URL TBD',
        },
        {
          title: 'System requirements',
          body: 'List supported OS, CPU, and memory requirements in a short pre-release form.',
          state: 'Recommended',
          details: [
            'macOS: Apple Silicon (M1 or later)',
            'Windows: x86_64',
            'Memory: 4 GB or more, 8 GB or more recommended',
          ],
        },
        {
          title: 'Known limitations',
          body: 'Document limitations to check before use and distribution channels that are not promised yet.',
          state: 'Pending',
          details: [
            'Linux is not supported at this time',
            'macOS and Windows builds are planned as unsigned builds',
            'Auto-update is not supported yet',
            'Performance and Git reference resolution may be limited when using WSL environments or files located inside WSL because file watching and I/O can be slower across that boundary.',
          ],
        },
        {
          title: 'Repository / Issues',
          body: 'This will link to the public repository, issue tracker, and security policy.',
          state: 'URL TBD',
        },
        {
          title: 'Security / signing',
          body: 'Until code signing and distribution channels are decided, this page treats builds as unsigned and documents the required caution.',
          state: 'Pending',
          details: [
            'macOS and Windows builds are planned as unsigned builds',
            'Only allow artifacts obtained from the official release',
          ],
        },
      ],
    },
    platformSupport: {
      heading: 'Platform support',
      rows: [
        {
          platform: 'macOS',
          status: 'Supported',
          command: 'xattr -dr com.apple.quarantine /Applications/Svard.app',
          note: 'Run this only after confirming that the app came from the official release. Control-click Open in Finder or System Settings approval can also be used.',
        },
        {
          platform: 'Windows',
          status: 'Supported',
          command: 'Unblock-File -Path .\\Svard.exe',
          note: 'Run this in PowerShell for the downloaded executable. If SmartScreen appears, use More info and then Run anyway.',
        },
        {
          platform: 'Linux',
          status: 'Unsupported',
          command: 'None',
          note: 'Linux artifacts, package-manager commands, and launch instructions are not provided at this time.',
        },
      ],
    },
    notes: [
      'GitHub Releases, Changelog, and Repository / Issues links will be replaced after public URLs are decided.',
      'App Store badges and package-manager commands are not shown until those channels are supported.',
      'Auto-update promises are not shown until implementation and distribution are decided.',
      'Commands should only be used for artifacts obtained from the official release.',
    ],
  },
};

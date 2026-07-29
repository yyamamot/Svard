export const OPENUI_BASIC_PROFILE_COMPONENTS = [
  "SvardExperience",
  "Heading",
  "TextContent",
  "Callout",
  "Grid",
  "StatCard",
  "KeyValue",
  "Table",
  "Checklist",
  "Timeline",
  "CodeBlock",
  "CodeDiff",
  "FileReference",
  "FileList",
  "OpenFileButton",
  "Image",
  "FollowUpButton",
  "AgentActionButton",
] as const;

// Table requires Col in the current OpenUI Lang schema. It is evaluated as a
// structural dependency rather than as a separate reader-facing component.
export const OPENUI_BASIC_PROFILE_STRUCTURAL_COMPONENTS = ["Col"] as const;

export const OPENUI_BASIC_KEEP_COMPONENTS = [
  "SvardExperience",
  "Heading",
  "TextContent",
  "Callout",
  "KeyValue",
  "Table",
  "Checklist",
  "CodeDiff",
  "FileList",
  "FollowUpButton",
] as const;

export const OPENUI_BASIC_HOLD_COMPONENTS = [
  "Grid",
  "Timeline",
  "CodeBlock",
  "Image",
] as const;

export const OPENUI_BASIC_BALANCED_COMPONENTS = [
  ...OPENUI_BASIC_KEEP_COMPONENTS,
  ...OPENUI_BASIC_HOLD_COMPONENTS,
] as const;

export const OPENUI_BASIC_LEAN_COMPONENTS = OPENUI_BASIC_KEEP_COMPONENTS;

export const OPENUI_BASIC_REVIEW_FIXTURE = [
  'root = SvardExperience("Document review brief", "A document-first review of the proposed OpenUI basic profile.", [summary, status, evidence, coverage, diff, files, openSpec, followup, action])',
  'summary = Callout("info", "Review scope", "The basic profile is being evaluated without changing the production allowlist.")',
  'status = Grid([{title:"Candidate components",value:"18",detail:"Reader-facing profile"},{title:"Production components",value:"74",detail:"Unchanged during evaluation"},{title:"Decision",value:"Human review",detail:"Keep, Drop, or Hold"}], 3)',
  'evidence = KeyValue([{label:"Primary use",value:"Document review"},{label:"Runtime",value:"Mock provider fixture"},{label:"Safety boundary",value:"No external resources or direct tool calls"}])',
  'coverage = Checklist([{label:"Change summary is scannable",checked:true,detail:"Key facts appear before detail"},{label:"Evidence links remain actionable",checked:true,detail:"Workspace-relative paths only"},{label:"Charts are required",checked:false,detail:"Evaluate separately in the challenger screen"}])',
  'diff = CodeDiff("Profile selection", "ts", "const components = fullLibrary;", "const components = basicProfile;")',
  'files = FileList("Review targets", [{path:"src/ui/codex/openUiRegistry.tsx",role:"Current component registry",detail:"Production behavior remains unchanged"},{path:"docs/04-implementation-plan.md",role:"Adoption status",detail:"IMP-465 evaluation checkpoint"}])',
  'openSpec = OpenFileButton("Open Agent Chat specification", "docs/contracts/appendix-agent-chat.md")',
  'followup = FollowUpButton("Compare omitted components", "Compare the omitted OpenUI components with this review-oriented profile.", "Starts a new review turn")',
  'action = AgentActionButton("Inspect current registry", "Inspect the current OpenUI registry without changing files.", "Observe mode and approval boundaries still apply")',
].join("\n");

export const OPENUI_BASIC_GALLERY_FIXTURE = [
  'root = SvardExperience("Basic profile gallery", "The 18 proposed reader-facing components shown with representative document-review content.", [heading, text, callout, grid, stat, keyvalue, table, checklist, timeline, code, diff, fileref, filelist, image, openfile, followup, action])',
  'heading = Heading("Review-oriented building blocks", 2)',
  'text = TextContent("Use compact summaries first, then provide evidence, verification status, and safe navigation.")',
  'callout = Callout("warning", "Needs verification", "Rendered diagrams and external links have not been verified.")',
  'grid = Grid([{title:"Observed",value:"6",detail:"Directly supported findings"},{title:"Inferred",value:"2",detail:"Requires reviewer judgment"}], 2)',
  'stat = StatCard("Review coverage", "75%", "Three of four target areas inspected", "info")',
  'keyvalue = KeyValue([{label:"Snapshot",value:"Working tree"},{label:"Mode",value:"Visualize"},{label:"Profile",value:"Basic candidate"}])',
  'table = Table([Col("Component", ["Table","CodeDiff","FileList"]), Col("Review role", ["Comparison","Before and after","Evidence targets"])])',
  'checklist = Checklist([{label:"Source inspected",checked:true},{label:"Rendered output checked",checked:true},{label:"Native smoke run",checked:false}])',
  'timeline = Timeline([{label:"1",title:"Collect evidence",status:"completed"},{label:"2",title:"Human component review",status:"active"},{label:"3",title:"Adopt profile",status:"pending"}])',
  'code = CodeBlock("md", "## Review note\\nKeep claims tied to workspace evidence.")',
  'diff = CodeDiff("Prompt boundary", "ts", "visualizationInstructions: fullPrompt", "visualizationInstructions: basicPrompt")',
  'fileref = FileReference("docs/04-implementation-plan.md", "IMP-465 plan", "Canonical task status")',
  'filelist = FileList("Evidence", [{path:"docs/contracts/appendix-agent-chat.md",role:"Safety contract"},{path:"src/ui/codex/openUiRegistry.tsx",role:"Component registry"}])',
  'image = Image("workspace", "assets/svard-sample.svg", "Svard sample document image", "Safe workspace-relative image")',
  'openfile = OpenFileButton("Open evaluation target", "src/ui/codex/openUiRegistry.tsx")',
  'followup = FollowUpButton("Explain the shortlist", "Explain why each basic profile component was shortlisted.")',
  'action = AgentActionButton("Check profile coverage", "Check whether the basic profile covers the current document-review examples.")',
].join("\n");

export const OPENUI_COMPONENT_CHALLENGERS_FIXTURE = [
  'root = SvardExperience("Component challengers", "Examples intentionally outside the proposed basic profile. Compare their value against simpler retained components.", [form, tabs, accordion, map, gallery, chart])',
  'chart = BarChart(["Source","Rendered","Links"], [Series("Reviewed", [8,5,3])], "grouped", "Review area", "Items")',
  'form = Form("review-filter", buttons, [field])',
  "buttons = Buttons([button])",
  'button = Button("Apply filter")',
  'field = FormControl("Reviewer note", input, "Local form state only")',
  'input = Input("review-note", "Optional note")',
  "tabs = Tabs([tabObserved, tabInferred])",
  'tabObserved = TabItem("observed", "Observed", [TextContent("Findings backed directly by the current workspace snapshot.")])',
  'tabInferred = TabItem("inferred", "Inferred", [TextContent("Potential impact that still needs reviewer confirmation.")])',
  "accordion = Accordion([sectionCoverage, sectionOmissions])",
  'sectionCoverage = AccordionItem("coverage", "Coverage", [TextContent("Documents, rendered changes, and diagnostics inspected.")])',
  'sectionOmissions = AccordionItem("omissions", "Omissions", [TextContent("Native smoke and external links were not verified.")])',
  'map = FileMap("Document relationships", [{id:"spec",path:"docs/01-specification.md",role:"Requirement"},{id:"ui",path:"src/ui/codex/openUiRegistry.tsx",role:"Implementation"}], [{from:"spec",to:"ui",label:"constrains"}])',
  'gallery = ImageGallery([{kind:"workspace",source:"assets/svard-sample.svg",alt:"Rendered document sample",caption:"Workspace image"},{kind:"workspace",source:"assets/svard-sample.svg",alt:"Repeated comparison sample",caption:"Gallery layout"}])',
].join("\n");

export const OPENUI_BASIC_BALANCED_FIXTURE = [
  'root = SvardExperience("Balanced profile — 14 components", "The approved document-review profile used by live Visualize turns.", [heading, text, callout, grid, metadata, findings, checks, timeline, code, diff, files, image, followup])',
  'heading = Heading("Document review result", 2)',
  'text = TextContent("Live Visualize now uses the balanced prompt, parser, and renderer while restored read-only history keeps full-library compatibility.")',
  'callout = Callout("info", "Balanced selected", "Grid, Timeline, CodeBlock, and Image were retained after human review.")',
  'grid = Grid([{title:"Findings",value:"3",detail:"Two verified"},{title:"Open risk",value:"1",detail:"Native validation pending"},{title:"Prompt",value:"< 10 KB",detail:"Measured as UTF-8 bytes"}], 3)',
  'metadata = KeyValue([{label:"Primary use",value:"Document review"},{label:"Profile",value:"Balanced 14"},{label:"Runtime",value:"Fixed Mock fixture"}])',
  'findings = Table([Col("Finding", ["Prompt scope","History compatibility","Safety boundary"]), Col("Status", ["Verified","Preserved","Verified"]), Col("Evidence", ["Profile metrics","Full read-only renderer","Workspace-relative resources"])])',
  'checks = Checklist([{label:"Selected schema only",checked:true},{label:"Production profile switched",checked:true},{label:"Human review complete",checked:true}])',
  'timeline = Timeline([{label:"1",title:"Compare profiles",status:"completed"},{label:"2",title:"Human Keep or Drop decision",status:"completed"},{label:"3",title:"Evaluate real Codex generation",status:"active"}])',
  'code = CodeBlock("ts", "const selectedProfile = turn.restored ? full : balanced;")',
  'diff = CodeDiff("Profile boundary", "ts", "visualizationInstructions: fullPrompt", "visualizationInstructions: balancedPrompt")',
  'files = FileList("Evidence", [{path:"docs/research/openui-basic-profile-evaluation.md",role:"Decision record"},{path:"src/ui/codex/openUiRegistry.tsx",role:"Scoped libraries"},{path:"docs/04-implementation-plan.md",role:"Adoption checkpoint"}])',
  'image = Image("workspace", "assets/svard-sample.svg", "Rendered document evidence", "Image is available only in the balanced profile")',
  'followup = FollowUpButton("Prepare real Codex evaluation", "Run the fixed five questions twice after model-call approval.")',
].join("\n");

export const OPENUI_BASIC_LEAN_FIXTURE = [
  'root = SvardExperience("Lean profile — 10 components", "The same document review expressed using only the recommended Keep components.", [heading, text, callout, metrics, metadata, findings, stages, checks, diff, files, followup])',
  'heading = Heading("Document review result", 2)',
  'text = TextContent("The implementation keeps production behavior unchanged while the basic profile is evaluated.")',
  'callout = Callout("warning", "Needs human decision", "Grid, Timeline, CodeBlock, and Image are represented with simpler retained components.")',
  'metrics = KeyValue([{label:"Findings",value:"3"},{label:"Verified",value:"2"},{label:"Open risk",value:"Native validation pending"},{label:"Prompt",value:"< 10 KB"}])',
  'metadata = KeyValue([{label:"Primary use",value:"Document review"},{label:"Profile",value:"Lean 10"},{label:"Runtime",value:"Fixed Mock fixture"}])',
  'findings = Table([Col("Finding", ["Prompt scope","History compatibility","Safety boundary"]), Col("Status", ["Verified","Preserved","Verified"]), Col("Evidence", ["Profile metrics","Full read-only renderer","Workspace-relative resources"])])',
  'stages = Table([Col("Stage", ["1","2","3"]), Col("Decision flow", ["Compare profiles","Human Keep or Drop decision","Adopt approved profile"]), Col("Status", ["Completed","Active","Pending"])])',
  'checks = Checklist([{label:"Selected schema only",checked:true},{label:"Production profile switched",checked:false},{label:"Human review complete",checked:false},{label:"Code evidence represented by the before and after comparison",checked:true},{label:"Visual evidence remains available as a workspace file",checked:true}])',
  'diff = CodeDiff("Profile boundary", "ts", "visualizationInstructions: fullPrompt", "visualizationInstructions: approvedBasicPrompt")',
  'files = FileList("Evidence", [{path:"docs/research/openui-basic-profile-evaluation.md",role:"Decision record"},{path:"src/ui/codex/openUiRegistry.tsx",role:"Scoped libraries"},{path:"docs/04-implementation-plan.md",role:"Adoption checkpoint"},{path:"assets/svard-sample.svg",role:"Visual evidence without inline Image"}])',
  'followup = FollowUpButton("Review the lean replacements", "Decide whether the simpler Grid, Timeline, CodeBlock, and Image replacements are sufficient.")',
].join("\n");

const openUiLimitRows = Array.from(
  { length: 101 },
  (_, index) => `Review item ${index + 1}`,
);

export const OPENUI_BASIC_LIMIT_DIAGNOSTIC_FIXTURE = [
  'root = SvardExperience("Balanced limit diagnostic", "A deterministic Table response that exceeds the live profile row limit.", [table])',
  `table = Table([Col("Review item", ${JSON.stringify(openUiLimitRows)})])`,
].join("\n");

export function isOpenUiProfileComparisonQuestion(question: string) {
  const normalized = question.toLowerCase();
  return (
    normalized.includes("openui balanced profile comparison") ||
    normalized.includes("openui lean profile comparison") ||
    normalized.includes("openui balanced limit diagnostic")
  );
}

export function mockOpenUiEvaluationAnswer(question: string) {
  const normalized = question.toLowerCase();
  if (normalized.includes("openui basic profile review")) {
    return OPENUI_BASIC_REVIEW_FIXTURE;
  }
  if (normalized.includes("openui basic profile gallery")) {
    return OPENUI_BASIC_GALLERY_FIXTURE;
  }
  if (normalized.includes("openui component challengers")) {
    return OPENUI_COMPONENT_CHALLENGERS_FIXTURE;
  }
  if (normalized.includes("openui balanced profile comparison")) {
    return OPENUI_BASIC_BALANCED_FIXTURE;
  }
  if (normalized.includes("openui lean profile comparison")) {
    return OPENUI_BASIC_LEAN_FIXTURE;
  }
  if (normalized.includes("openui balanced limit diagnostic")) {
    return OPENUI_BASIC_LIMIT_DIAGNOSTIC_FIXTURE;
  }
  return null;
}

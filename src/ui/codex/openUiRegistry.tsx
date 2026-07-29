import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { openuiChatLibrary } from "@openuidev/react-ui";
import { useContext, useEffect, useMemo, useState } from "react";
import { z } from "zod/v4";
import { MAX_GALLERY_IMAGES, MAX_OPENUI_NODES } from "./openUiLimits";
import { SvardOpenUiRuntimeContext } from "./openUiRuntime";

const Heading = defineComponent({
  name: "Heading",
  description: "A section heading. Level must be 2, 3, or 4.",
  props: z
    .object({
      text: z.string(),
      level: z.number().int().min(2).max(4).optional(),
    })
    .strict(),
  component: ({ props }) => {
    const Tag = `h${props.level ?? 3}` as "h2" | "h3" | "h4";
    return <Tag>{props.text}</Tag>;
  },
});

const KeyValue = defineComponent({
  name: "KeyValue",
  description: "A compact list of labels and values.",
  props: z
    .object({
      items: z
        .array(z.object({ label: z.string(), value: z.string() }).strict())
        .max(40),
    })
    .strict(),
  component: ({ props }) => (
    <dl className="codex-openui-key-values">
      {props.items.map((item, index) => (
        <div key={`${index}:${item.label}`}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  ),
});

const StatCard = defineComponent({
  name: "StatCard",
  description: "A single prominent metric with an optional supporting detail.",
  props: z
    .object({
      label: z.string(),
      value: z.string(),
      detail: z.string().optional(),
      tone: z.enum(["neutral", "info", "success", "warning"]).optional(),
    })
    .strict(),
  component: ({ props }) => (
    <article
      className="codex-openui-stat-card"
      data-tone={props.tone ?? "neutral"}
    >
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.detail ? <small>{props.detail}</small> : null}
    </article>
  ),
});

const Grid = defineComponent({
  name: "Grid",
  description: "A responsive grid of summary cards.",
  props: z
    .object({
      items: z
        .array(
          z
            .object({
              title: z.string(),
              value: z.string(),
              detail: z.string().optional(),
            })
            .strict(),
        )
        .min(1)
        .max(24),
      columns: z.number().int().min(1).max(4).optional(),
    })
    .strict(),
  component: ({ props }) => (
    <div
      className="codex-openui-grid"
      data-review-id="agent-openui-grid"
      style={{ "--openui-columns": props.columns ?? 2 } as React.CSSProperties}
    >
      {props.items.map((item, index) => (
        <article key={`${index}:${item.title}`}>
          <span>{item.title}</span>
          <strong>{item.value}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
        </article>
      ))}
    </div>
  ),
});

const Timeline = defineComponent({
  name: "Timeline",
  description: "An ordered timeline of events or implementation stages.",
  props: z
    .object({
      items: z
        .array(
          z
            .object({
              label: z.string(),
              title: z.string(),
              detail: z.string().optional(),
              status: z
                .enum(["pending", "active", "completed", "blocked"])
                .optional(),
            })
            .strict(),
        )
        .max(40),
    })
    .strict(),
  component: ({ props }) => (
    <ol className="codex-openui-timeline">
      {props.items.map((item, index) => (
        <li
          key={`${index}:${item.label}`}
          data-status={item.status ?? "pending"}
        >
          <span>{item.label}</span>
          <div>
            <strong>{item.title}</strong>
            {item.detail ? <p>{item.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  ),
});

const Checklist = defineComponent({
  name: "Checklist",
  description: "A non-editable checklist with explicit item status.",
  props: z
    .object({
      items: z
        .array(
          z
            .object({
              label: z.string(),
              checked: z.boolean(),
              detail: z.string().optional(),
            })
            .strict(),
        )
        .max(60),
    })
    .strict(),
  component: ({ props }) => (
    <ul className="codex-openui-checklist">
      {props.items.map((item, index) => (
        <li key={`${index}:${item.label}`} data-checked={item.checked}>
          <span aria-hidden="true">{item.checked ? "✓" : "○"}</span>
          <div>
            <strong>{item.label}</strong>
            {item.detail ? <small>{item.detail}</small> : null}
          </div>
        </li>
      ))}
    </ul>
  ),
});

const Progress = defineComponent({
  name: "Progress",
  description: "A labelled progress indicator from zero to one hundred.",
  props: z
    .object({
      label: z.string(),
      value: z.number().finite().min(0).max(100),
      detail: z.string().optional(),
    })
    .strict(),
  component: ({ props }) => (
    <div className="codex-openui-progress">
      <div>
        <span>{props.label}</span>
        <strong>{props.value}%</strong>
      </div>
      <progress max={100} value={props.value} />
      {props.detail ? <small>{props.detail}</small> : null}
    </div>
  ),
});

const CodeDiff = defineComponent({
  name: "CodeDiff",
  description: "A static before and after code comparison.",
  props: z
    .object({
      title: z.string().optional(),
      language: z.string().optional(),
      before: z.string(),
      after: z.string(),
    })
    .strict(),
  component: ({ props }) => (
    <section className="codex-openui-code-diff">
      {props.title ? <h3>{props.title}</h3> : null}
      <div>
        <figure>
          <figcaption>Before</figcaption>
          <pre>
            <code>{props.before}</code>
          </pre>
        </figure>
        <figure>
          <figcaption>After</figcaption>
          <pre>
            <code>{props.after}</code>
          </pre>
        </figure>
      </div>
    </section>
  ),
});

const FileReference = defineComponent({
  name: "FileReference",
  description:
    "A workspace-relative file reference. It may be opened by the user.",
  props: z
    .object({
      path: z.string(),
      label: z.string().optional(),
      detail: z.string().optional(),
    })
    .strict(),
  component: ({ props }) => {
    const runtime = useContext(SvardOpenUiRuntimeContext);
    return (
      <button
        type="button"
        className="codex-openui-file-reference"
        disabled={runtime.disabled || !runtime.onOpenFile}
        onClick={() => runtime.onOpenFile?.(props.path)}
      >
        <strong>{props.label ?? props.path}</strong>
        <span>{props.path}</span>
        {props.detail ? <small>{props.detail}</small> : null}
      </button>
    );
  },
});

const FileList = defineComponent({
  name: "FileList",
  description: "A grouped list of workspace-relative files and their roles.",
  props: z
    .object({
      title: z.string().optional(),
      files: z
        .array(
          z
            .object({
              path: z.string(),
              role: z.string().optional(),
              detail: z.string().optional(),
            })
            .strict(),
        )
        .max(80),
    })
    .strict(),
  component: ({ props }) => {
    const runtime = useContext(SvardOpenUiRuntimeContext);
    return (
      <section
        className="codex-openui-file-list"
        data-review-id="agent-openui-file-list"
      >
        {props.title ? <h3>{props.title}</h3> : null}
        <ul>
          {props.files.map((file, index) => (
            <li key={`${index}:${file.path}`}>
              <button
                type="button"
                disabled={runtime.disabled || !runtime.onOpenFile}
                onClick={() => runtime.onOpenFile?.(file.path)}
              >
                {file.path}
              </button>
              {file.role ? <strong>{file.role}</strong> : null}
              {file.detail ? <small>{file.detail}</small> : null}
            </li>
          ))}
        </ul>
      </section>
    );
  },
});

const FileMap = defineComponent({
  name: "FileMap",
  description: "A static relationship map between workspace-relative files.",
  props: z
    .object({
      title: z.string().optional(),
      nodes: z
        .array(
          z
            .object({
              id: z.string(),
              path: z.string(),
              role: z.string().optional(),
            })
            .strict(),
        )
        .max(40),
      edges: z
        .array(
          z
            .object({
              from: z.string(),
              to: z.string(),
              label: z.string().optional(),
            })
            .strict(),
        )
        .max(80),
    })
    .strict(),
  component: ({ props }) => {
    const names = new Map(props.nodes.map((node) => [node.id, node.path]));
    return (
      <section className="codex-openui-file-map">
        {props.title ? <h3>{props.title}</h3> : null}
        <div>
          {props.nodes.map((node) => (
            <span key={node.id}>
              <strong>{node.path}</strong>
              {node.role ? <small>{node.role}</small> : null}
            </span>
          ))}
        </div>
        <ul>
          {props.edges.map((edge, index) => (
            <li key={`${index}:${edge.from}:${edge.to}`}>
              <code>{names.get(edge.from) ?? edge.from}</code>
              <span>→</span>
              <code>{names.get(edge.to) ?? edge.to}</code>
              {edge.label ? <small>{edge.label}</small> : null}
            </li>
          ))}
        </ul>
      </section>
    );
  },
});

function resolvedImageDataUrl(
  content: string,
  mediaType: string | undefined,
  encoding: "base64" | "utf8" | undefined,
) {
  if (!mediaType || encoding !== "base64") return null;
  return `data:${mediaType};base64,${content}`;
}

function SvardImageView({
  alt,
  caption,
  kind,
  source,
}: {
  alt: string;
  caption?: string;
  kind: "attached" | "workspace";
  source: string;
}) {
  const runtime = useContext(SvardOpenUiRuntimeContext);
  const attached = useMemo(
    () =>
      runtime.images?.find(
        (image) =>
          image.displayLabel === source ||
          image.displayLabel.split(/[\\/]/u).pop() === source,
      ),
    [runtime.images, source],
  );
  const [workspaceSource, setWorkspaceSource] = useState<string | null>(null);
  useEffect(() => {
    if (kind !== "workspace" || !runtime.resolveWorkspaceImage) {
      setWorkspaceSource(null);
      return;
    }
    let cancelled = false;
    void runtime.resolveWorkspaceImage(source).then((result) => {
      if (!cancelled) setWorkspaceSource(result);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, runtime, source]);
  const src =
    kind === "attached" ? attached?.thumbnailDataUrl : workspaceSource;
  return (
    <figure className="codex-openui-safe-image">
      {src ? <img src={src} alt={alt} /> : <div>{alt}</div>}
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

const safeImageProps = () =>
  z
    .object({
      kind: z.enum(["attached", "workspace"]),
      source: z.string(),
      alt: z.string(),
      caption: z.string().optional(),
    })
    .strict();

const Image = defineComponent({
  name: "Image",
  description:
    "A safe image. kind is attached or workspace; source is an attachment display name or workspace-relative path. URLs are forbidden.",
  props: safeImageProps(),
  component: ({ props }) => <SvardImageView {...props} />,
});

const ImageBlock = defineComponent({
  name: "ImageBlock",
  description:
    "A safe full-width image using an attachment name or workspace-relative path.",
  props: safeImageProps(),
  component: ({ props }) => <SvardImageView {...props} />,
});

const ImageGallery = defineComponent({
  name: "ImageGallery",
  description:
    "A gallery of safe attached or workspace images. URLs are forbidden.",
  props: z
    .object({
      images: z.array(safeImageProps()).min(1).max(MAX_GALLERY_IMAGES),
    })
    .strict(),
  component: ({ props }) => (
    <div className="codex-openui-image-gallery">
      {props.images.map((image, index) => (
        <SvardImageView key={`${index}:${image.source}`} {...image} />
      ))}
    </div>
  ),
});

const DropdownMenu = defineComponent({
  name: "DropdownMenu",
  description:
    "A compact menu whose selected item starts a follow-up Agent turn.",
  props: z
    .object({
      label: z.string(),
      items: z
        .array(
          z
            .object({
              label: z.string(),
              message: z.string(),
            })
            .strict(),
        )
        .min(1)
        .max(20),
    })
    .strict(),
  component: ({ props }) => {
    const runtime = useContext(SvardOpenUiRuntimeContext);
    return (
      <label className="codex-openui-dropdown">
        <span>{props.label}</span>
        <select
          disabled={runtime.disabled || !runtime.onAgentAction}
          defaultValue=""
          onChange={(event) => {
            const message = event.currentTarget.value;
            if (message) runtime.onAgentAction?.(message);
            event.currentTarget.value = "";
          }}
        >
          <option value="">Choose…</option>
          {props.items.map((item, index) => (
            <option key={`${index}:${item.label}`} value={item.message}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    );
  },
});

function createActionComponent(
  name: "FollowUpButton" | "AgentActionButton",
  description: string,
) {
  return defineComponent({
    name,
    description,
    props: z
      .object({
        label: z.string(),
        message: z.string(),
        detail: z.string().optional(),
      })
      .strict(),
    component: ({ props }) => {
      const runtime = useContext(SvardOpenUiRuntimeContext);
      return (
        <button
          type="button"
          className="codex-openui-action"
          data-review-id="agent-openui-action"
          disabled={runtime.disabled || !runtime.onAgentAction}
          onClick={() => runtime.onAgentAction?.(props.message)}
        >
          <strong>{props.label}</strong>
          {props.detail ? <small>{props.detail}</small> : null}
        </button>
      );
    },
  });
}

const FollowUpButton = createActionComponent(
  "FollowUpButton",
  "Starts a conversational follow-up in the same Agent chat.",
);
const AgentActionButton = createActionComponent(
  "AgentActionButton",
  "Requests an Agent operation in a new turn. Existing sandbox and approvals still apply.",
);

const OpenFileButton = defineComponent({
  name: "OpenFileButton",
  description: "Opens a workspace-relative document in Svard.",
  props: z
    .object({
      label: z.string(),
      path: z.string(),
    })
    .strict(),
  component: ({ props }) => {
    const runtime = useContext(SvardOpenUiRuntimeContext);
    return (
      <button
        type="button"
        className="codex-openui-action"
        disabled={runtime.disabled || !runtime.onOpenFile}
        onClick={() => runtime.onOpenFile?.(props.path)}
      >
        {props.label}
      </button>
    );
  },
});

const replacedBuiltins = new Set(["Image", "ImageBlock", "ImageGallery"]);
const standardComponents = Object.values(openuiChatLibrary.components).filter(
  (component) => !replacedBuiltins.has(component.name),
);
const customComponents = [
  Heading,
  KeyValue,
  StatCard,
  Grid,
  Timeline,
  Checklist,
  Progress,
  CodeDiff,
  FileReference,
  FileList,
  FileMap,
  Image,
  ImageBlock,
  ImageGallery,
  DropdownMenu,
  FollowUpButton,
  AgentActionButton,
  OpenFileButton,
];
const allContentComponents = [...standardComponents, ...customComponents];
type SvardContentComponent = (typeof allContentComponents)[number];

const componentCatalog = new Map(
  allContentComponents.map((component) => [component.name, component]),
);

export const SVARD_OPENUI_BALANCED_COMPONENTS = [
  "Heading",
  "TextContent",
  "Callout",
  "Grid",
  "KeyValue",
  "Table",
  "Col",
  "Checklist",
  "Timeline",
  "CodeBlock",
  "CodeDiff",
  "FileList",
  "Image",
  "FollowUpButton",
] as const;

export const SVARD_OPENUI_LEAN_COMPONENTS = [
  "Heading",
  "TextContent",
  "Callout",
  "KeyValue",
  "Table",
  "Col",
  "Checklist",
  "CodeDiff",
  "FileList",
  "FollowUpButton",
] as const;

function selectComponents(names: readonly string[]) {
  return names.map((name) => {
    const component = componentCatalog.get(name);
    if (!component) {
      throw new Error(`Unknown Svard OpenUI component: ${name}`);
    }
    return component;
  });
}

function createSvardExperience(components: readonly SvardContentComponent[]) {
  const contentRefs = components.map((component) => component.ref) as [
    z.ZodTypeAny,
    z.ZodTypeAny,
    ...z.ZodTypeAny[],
  ];
  return defineComponent({
    name: "SvardExperience",
    description:
      "Root container for a structured Agent answer. Compose only components that materially improve understanding.",
    props: z
      .object({
        title: z.string().optional(),
        summary: z.string().optional(),
        content: z.array(z.union(contentRefs)).max(MAX_OPENUI_NODES),
      })
      .strict(),
    component: ({ props, renderNode }) => (
      <article
        className="codex-openui-answer codex-openui-experience"
        data-review-id="agent-openui-experience"
      >
        {props.title ? <h2>{props.title}</h2> : null}
        {props.summary ? (
          <p className="codex-openui-summary">{props.summary}</p>
        ) : null}
        {renderNode(props.content)}
      </article>
    ),
  });
}

function createSvardLibrary(id: string, components: SvardContentComponent[]) {
  return createLibrary({
    id,
    root: "SvardExperience",
    components: [createSvardExperience(components), ...components],
  });
}

export const svardOpenUiLibrary = createSvardLibrary(
  "svard-openui-exploration",
  allContentComponents,
);

export const svardOpenUiBalancedLibrary = createSvardLibrary(
  "svard-openui-basic-balanced",
  selectComponents(SVARD_OPENUI_BALANCED_COMPONENTS),
);

export const svardOpenUiLeanLibrary = createSvardLibrary(
  "svard-openui-basic-lean",
  selectComponents(SVARD_OPENUI_LEAN_COMPONENTS),
);

export const svardOpenUiPrompt = svardOpenUiLibrary.prompt({
  preamble:
    "You may answer with plain text or build a structured, accessible UI when it materially improves a workspace answer. In Visualize mode, return only the Svard OpenUI Lang interface described here.",
  inlineMode: false,
  toolCalls: false,
  bindings: true,
  additionalRules: [
    "This OpenUI contract is the only visualization mechanism for this response. Do not invoke or follow a visualize or visualization skill, and do not create Mermaid, HTML, a website, or a visualization file.",
    "Start structured answers with root = SvardExperience(...).",
    "Return OpenUI Lang source only. Do not add prose before or after it and do not use a non-OpenUI fenced block.",
    "Never emit HTML, scripts, remote URLs, absolute paths, data URLs, Query, Mutation, or tool calls.",
    "Use Image only with kind attached and an attachment display name, or kind workspace and a workspace-relative path.",
    "Use FollowUpButton or AgentActionButton to request another Agent turn. The current sandbox and approval policy still apply.",
    "Use OpenFileButton or FileReference only with workspace-relative document paths.",
    "Prefer plain text when a generated interface would not improve comprehension.",
  ],
  examples: [
    'root = SvardExperience("Workspace overview", "A compact view of the main responsibilities.", [stats, files])\nstats = Grid([{title:"Documents",value:"12",detail:"Markdown and AsciiDoc"},{title:"Code",value:"8",detail:"TypeScript and Rust"}], 2)\nfiles = FileList("Key files", [{path:"src/ui/App.tsx",role:"UI shell"},{path:"src-tauri/src/lib.rs",role:"Tauri backend"}])',
  ],
});

const basicPromptRules = [
  "This OpenUI contract is the only visualization mechanism for this response. Do not invoke or follow a visualize or visualization skill, and do not create Mermaid, HTML, a website, or a visualization file.",
  "Start structured answers with root = SvardExperience(...).",
  "Return OpenUI Lang source only. Do not add prose before or after it and do not use a non-OpenUI fenced block.",
  "Never emit HTML, scripts, remote URLs, absolute paths, data URLs, Query, Mutation, or tool calls.",
  "Use FollowUpButton to request another Agent turn. The current sandbox and approval policy still apply.",
  "Use FileList only with workspace-relative document paths.",
  "Prefer plain text when a generated interface would not improve comprehension.",
];

const basicPromptOptions = {
  preamble:
    "You may answer with plain text or build a structured, accessible UI when it materially improves a workspace answer. In Visualize mode, return only the Svard OpenUI Lang interface described here.",
  inlineMode: false,
  toolCalls: false,
  bindings: true,
};

export const svardOpenUiBalancedPrompt = svardOpenUiBalancedLibrary.prompt({
  ...basicPromptOptions,
  additionalRules: [
    ...basicPromptRules.slice(0, 4),
    "Use Image only with kind attached and an attachment display name, or kind workspace and a workspace-relative path.",
    ...basicPromptRules.slice(4),
  ],
  examples: [
    'root = SvardExperience("Workspace review", "A compact evidence summary.", [summary, files])\nsummary = Grid([{title:"Findings",value:"3",detail:"Two verified"}], 1)\nfiles = FileList("Evidence", [{path:"docs/01-specification.md",role:"Contract"}])',
  ],
});

export const svardOpenUiLeanPrompt = svardOpenUiLeanLibrary.prompt({
  ...basicPromptOptions,
  additionalRules: basicPromptRules,
  examples: [
    'root = SvardExperience("Workspace review", "A compact evidence summary.", [summary, files])\nsummary = KeyValue([{label:"Findings",value:"3"},{label:"Verified",value:"2"}])\nfiles = FileList("Evidence", [{path:"docs/01-specification.md",role:"Contract"}])',
  ],
});

export type SvardOpenUiProfile = "full" | "balanced" | "lean";

export const svardOpenUiLibraries = {
  full: svardOpenUiLibrary,
  balanced: svardOpenUiBalancedLibrary,
  lean: svardOpenUiLeanLibrary,
} as const;

export function workspaceImageDataUrl(
  result: {
    content?: string;
    encoding?: "base64" | "utf8";
    mediaType?: string;
    status: "resolved" | "blocked" | "error";
  } | null,
) {
  if (!result || result.status !== "resolved" || !result.content) return null;
  return resolvedImageDataUrl(
    result.content,
    result.mediaType,
    result.encoding,
  );
}

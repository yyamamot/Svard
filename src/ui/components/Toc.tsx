import type { Heading, HeadingInlineNode } from "../../core/types";

function renderInlineNodes(nodes: HeadingInlineNode[], keyPrefix: string) {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text":
        return node.value;
      case "code":
        return (
          <code className="toc-inline-code" key={key}>
            {node.value}
          </code>
        );
      case "strong":
        return (
          <strong key={key}>{renderInlineNodes(node.children, key)}</strong>
        );
      case "emphasis":
        return <em key={key}>{renderInlineNodes(node.children, key)}</em>;
    }
  });
}

export function Toc({
  activeHeadingId,
  headings,
  onNavigate,
}: {
  activeHeadingId: string | null;
  headings: Heading[];
  onNavigate: (headingId: string) => void;
}) {
  return (
    <nav className="toc" data-review-id="toc" aria-label="Table of contents">
      {headings.map((heading) => (
        <a
          key={heading.id}
          className={activeHeadingId === heading.id ? "active" : ""}
          href={`#${heading.id}`}
          data-context-menu-kind="toc-item"
          data-heading-id={heading.id}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(heading.id);
          }}
          style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
        >
          {heading.inline
            ? renderInlineNodes(heading.inline, heading.id)
            : heading.text}
        </a>
      ))}
    </nav>
  );
}

import type { Heading } from "../../core/types";

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
          {heading.text}
        </a>
      ))}
    </nav>
  );
}

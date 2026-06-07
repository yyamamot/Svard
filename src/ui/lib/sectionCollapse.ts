export function toggleSectionCollapse(button: HTMLElement) {
  const heading = button.closest<HTMLElement>(
    "[data-section-collapse-heading]",
  );
  if (!heading) {
    return;
  }

  const collapsed = heading.getAttribute("data-section-collapsed") !== "true";
  setSectionCollapsed(heading, collapsed);
}

export function expandCollapsedSectionsContaining(target: Element | null) {
  if (!target) {
    return;
  }

  const article = target.closest("article");
  if (!article) {
    return;
  }

  const collapsedHeadings = [
    ...article.querySelectorAll<HTMLElement>(
      "[data-section-collapse-heading][data-section-collapsed='true']",
    ),
  ];

  for (const heading of collapsedHeadings) {
    if (sectionElements(heading).some((element) => element.contains(target))) {
      setSectionCollapsed(heading, false);
    }
  }
}

function setSectionCollapsed(heading: HTMLElement, collapsed: boolean) {
  heading.setAttribute("data-section-collapsed", collapsed ? "true" : "false");
  heading.setAttribute("aria-expanded", collapsed ? "false" : "true");
  heading
    .querySelector<HTMLElement>("[data-section-collapse-toggle]")
    ?.setAttribute("aria-expanded", collapsed ? "false" : "true");
  for (const element of sectionElements(heading)) {
    element.classList.toggle("section-collapsed-hidden", collapsed);
  }
}

function sectionElements(heading: HTMLElement) {
  const level = headingLevel(heading);
  if (!level) {
    return [];
  }

  const elements: HTMLElement[] = [];
  let current = heading.nextElementSibling;
  while (current instanceof HTMLElement) {
    const currentLevel = headingLevel(current);
    if (currentLevel && currentLevel <= level) {
      break;
    }
    elements.push(current);
    current = current.nextElementSibling;
  }
  return elements;
}

function headingLevel(element: Element) {
  const match = /^H([1-6])$/.exec(element.tagName);
  return match ? Number(match[1]) : null;
}

import type { AppConfig } from "../../../core/types";

export function SidebarTabs({
  activeTab,
  onSelect,
}: {
  activeTab: AppConfig["workspace"]["sidebarTab"];
  onSelect: (tab: AppConfig["workspace"]["sidebarTab"]) => void;
}) {
  return (
    <div
      className="sidebar-tabs"
      data-review-id="sidebar-tabs"
      role="tablist"
      aria-label="Sidebar views"
    >
      <button
        type="button"
        className={activeTab === "files" ? "active" : ""}
        data-review-id="sidebar-tab-files"
        role="tab"
        aria-selected={activeTab === "files"}
        onClick={() => onSelect("files")}
      >
        Files
      </button>
      <button
        type="button"
        className={activeTab === "bookmarks" ? "active" : ""}
        data-review-id="sidebar-tab-bookmarks"
        role="tab"
        aria-selected={activeTab === "bookmarks"}
        onClick={() => onSelect("bookmarks")}
      >
        Bookmarks
      </button>
      <button
        type="button"
        className={activeTab === "sourceControl" ? "active" : ""}
        data-review-id="sidebar-tab-source-control"
        role="tab"
        aria-selected={activeTab === "sourceControl"}
        onClick={() => onSelect("sourceControl")}
      >
        Source Control
      </button>
    </div>
  );
}

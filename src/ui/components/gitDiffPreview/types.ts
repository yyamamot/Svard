export type DiffView = "overview" | "preview" | "source" | "rendered" | "table";

export interface OverviewSection {
  label: string;
  changeIndex: number;
  changeCount: number;
}

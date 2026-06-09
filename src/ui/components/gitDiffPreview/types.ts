export type DiffView = "overview" | "preview" | "source" | "rendered" | "table";

export interface OverviewSection {
  id: string;
  label: string;
  level: number;
  firstChangeIndex: number;
  changeCount: number;
  active: boolean;
}

import { dealStages, type Deal } from "./data";
import { STATE_LABELS } from "./transfer";

export type Tone = "brand" | "warning" | "neutral" | "live";

/** Human status for dashboards/admin. File deals keep their instant-delivery label. */
export function dealStatus(d: Deal): { label: string; tone: Tone } {
  if (d.kind === "file") return { label: "Completed", tone: "brand" };
  const a = d.acquisition;
  if (!a) return { label: dealStages(d)[d.stage] ?? "In progress", tone: "warning" };
  const tone: Tone = a.state === "completed" ? "brand" : a.state === "refunded" || a.state === "cancelled" ? "neutral" : a.state === "manual_review" ? "live" : "warning";
  return { label: STATE_LABELS[a.state], tone };
}

export const isDealCompleted = (d: Deal) => (d.kind === "file" ? true : d.acquisition ? d.acquisition.state === "completed" : d.stage === dealStages(d).length - 1);
export const isFundsProtected = (d: Deal) => d.kind !== "file" && d.acquisition?.payment.status === "held";

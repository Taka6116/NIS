import type { InsightActionItem, InsightFact, InsightHypothesisItem, InsightIssue } from "@/types/nis";

export type Stage1Payload = { facts: InsightFact[] };
export type Stage2Payload = { issues: InsightIssue[] };
export type Stage3Payload = { hypotheses: InsightHypothesisItem[] };
export type Stage4Payload = {
  summary: string;
  actions: InsightActionItem[];
  topPriority: { action: string; reason: string };
};

export function isStage1(o: unknown): o is Stage1Payload {
  if (!o || typeof o !== "object") return false;
  const x = o as Stage1Payload;
  return Array.isArray(x.facts);
}

export function isStage2(o: unknown): o is Stage2Payload {
  if (!o || typeof o !== "object") return false;
  const x = o as Stage2Payload;
  return Array.isArray(x.issues);
}

export function isStage3(o: unknown): o is Stage3Payload {
  if (!o || typeof o !== "object") return false;
  const x = o as Stage3Payload;
  return Array.isArray(x.hypotheses);
}

export function isStage4(o: unknown): o is Stage4Payload {
  if (!o || typeof o !== "object") return false;
  const x = o as Stage4Payload;
  return (
    typeof x.summary === "string" &&
    Array.isArray(x.actions) &&
    x.topPriority != null &&
    typeof (x.topPriority as { action?: string }).action === "string"
  );
}

export function cleanJsonText(json: string): string {
  return json.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

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
  if (!Array.isArray(x.hypotheses)) return false;
  return x.hypotheses.every(
    (h) =>
      h != null &&
      typeof (h as { id?: unknown }).id === "string" &&
      typeof (h as { issueId?: unknown }).issueId === "string" &&
      typeof (h as { statement?: unknown }).statement === "string",
  );
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

/** 拡張フィールドを可能なら整形。失われたフィールドは呼び出し側で補完する。 */
export function normalizeHypothesis(h: InsightHypothesisItem): InsightHypothesisItem {
  const factor = h.factorCategory;
  const allowed: InsightHypothesisItem["factorCategory"][] = [
    "crawl-index",
    "technical",
    "on-page",
    "content-quality",
    "authority",
    "ux-clarity",
    "tracking",
    "seasonality-external",
  ];
  return {
    ...h,
    factorCategory: factor && (allowed as string[]).includes(factor) ? factor : undefined,
    internalFactors: Array.isArray(h.internalFactors) ? h.internalFactors : undefined,
    externalFactors: Array.isArray(h.externalFactors) ? h.externalFactors : undefined,
  };
}

export function normalizeAction(a: InsightActionItem): InsightActionItem {
  const type = a.type;
  const allowedTypes: InsightActionItem["type"][] = ["quick-win", "strategic", "structural"];
  const ice = a.ice;
  const isIce =
    ice &&
    typeof ice.impact === "number" &&
    typeof ice.confidence === "number" &&
    typeof ice.ease === "number";
  const normalizedIce =
    isIce
      ? {
          impact: clamp(ice.impact, 1, 10),
          confidence: clamp(ice.confidence, 1, 10),
          ease: clamp(ice.ease, 1, 10),
          score:
            typeof ice.score === "number"
              ? ice.score
              : Math.round((clamp(ice.impact, 1, 10) * clamp(ice.confidence, 1, 10) * clamp(ice.ease, 1, 10)) / 10),
        }
      : undefined;
  const kpi = a.targetKpi;
  const normalizedKpi =
    kpi && typeof kpi.metric === "string" && (kpi.direction === "up" || kpi.direction === "down")
      ? {
          metric: kpi.metric,
          direction: kpi.direction,
          targetDelta: typeof kpi.targetDelta === "string" ? kpi.targetDelta : "",
          timelineWeeks: typeof kpi.timelineWeeks === "number" ? kpi.timelineWeeks : 4,
        }
      : undefined;
  return {
    ...a,
    type: type && (allowedTypes as string[]).includes(type) ? type : undefined,
    ice: normalizedIce,
    targetKpi: normalizedKpi,
    leadIndicator: typeof a.leadIndicator === "string" ? a.leadIndicator : undefined,
    risks: Array.isArray(a.risks) ? a.risks : undefined,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function cleanJsonText(json: string): string {
  return json.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

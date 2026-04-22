import type {
  InsightActionItem,
  InsightCritique,
  InsightDataCertainty,
  InsightDoNotDo,
  InsightFact,
  InsightHypothesisItem,
  InsightIssue,
  InsightProjectionPoint,
  InsightSeasonalityHint,
  InsightSeasonalityKind,
  InsightTalkingPoints,
} from "@/types/nis";

export type Stage1Payload = { facts: InsightFact[] };
export type Stage2Payload = { issues: InsightIssue[] };
export type Stage3Payload = { hypotheses: InsightHypothesisItem[] };
export type Stage4Payload = {
  summary: string;
  actions: InsightActionItem[];
  topPriority: { action: string; reason: string };
  doNotDo?: InsightDoNotDo[];
  talkingPoints?: InsightTalkingPoints;
};
export type Stage45Payload = {
  actions: Array<Pick<InsightActionItem, "id"> & {
    ice?: InsightActionItem["ice"];
    risks?: string[];
    critiques?: InsightCritique[];
  }>;
  additionalDoNotDo?: InsightDoNotDo[];
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

export function isStage45(o: unknown): o is Stage45Payload {
  if (!o || typeof o !== "object") return false;
  const x = o as Stage45Payload;
  return Array.isArray(x.actions);
}

const ALLOWED_FACTOR = [
  "crawl-index",
  "technical",
  "on-page",
  "content-quality",
  "authority",
  "ux-clarity",
  "tracking",
  "seasonality-external",
] as const;

const ALLOWED_DATA_CERTAINTY: InsightDataCertainty[] = [
  "observed",
  "single-signal-inferred",
  "multi-signal-inferred",
  "speculative",
];

const ALLOWED_SEASONALITY: InsightSeasonalityKind[] = [
  "trend",
  "seasonal",
  "residual",
  "unknown",
];

function clampEvidenceRefs(refs: unknown, knownFactIds: Set<string>): string[] | undefined {
  if (!Array.isArray(refs)) return undefined;
  const filtered = refs
    .filter((r): r is string => typeof r === "string")
    .filter((r) => knownFactIds.size === 0 || knownFactIds.has(r));
  return filtered.length > 0 ? filtered.slice(0, 6) : undefined;
}

export function normalizeSeasonalityHint(h: unknown): InsightSeasonalityHint | undefined {
  if (!h || typeof h !== "object") return undefined;
  const obj = h as InsightSeasonalityHint;
  const kind = ALLOWED_SEASONALITY.includes(obj.kind) ? obj.kind : "unknown";
  return {
    kind,
    seasonalShare:
      typeof obj.seasonalShare === "number" ? clamp(obj.seasonalShare, 0, 1) : undefined,
    note: typeof obj.note === "string" ? obj.note : undefined,
  };
}

export function normalizeFact(f: InsightFact): InsightFact {
  return {
    ...f,
    seasonalityHint: normalizeSeasonalityHint(f.seasonalityHint),
  };
}

export function normalizeHypothesis(
  h: InsightHypothesisItem,
  knownFactIds: Set<string> = new Set(),
): InsightHypothesisItem {
  const factor = h.factorCategory;
  return {
    ...h,
    factorCategory: factor && (ALLOWED_FACTOR as readonly string[]).includes(factor) ? factor : undefined,
    internalFactors: Array.isArray(h.internalFactors) ? h.internalFactors : undefined,
    externalFactors: Array.isArray(h.externalFactors) ? h.externalFactors : undefined,
    dataCertainty:
      h.dataCertainty && ALLOWED_DATA_CERTAINTY.includes(h.dataCertainty) ? h.dataCertainty : undefined,
    evidenceRefs: clampEvidenceRefs(h.evidenceRefs, knownFactIds),
    persona: typeof h.persona === "string" ? h.persona : undefined,
  };
}

function normalizeProjectionPoint(p: unknown): InsightProjectionPoint | null {
  if (!p || typeof p !== "object") return null;
  const x = p as InsightProjectionPoint;
  const horizonWeeks =
    x.horizonWeeks === 4 || x.horizonWeeks === 8 || x.horizonWeeks === 12 ? x.horizonWeeks : 4;
  const sessionsDelta =
    typeof x.sessionsDelta === "number" && Number.isFinite(x.sessionsDelta) ? x.sessionsDelta : 0;
  const conf = x.confidence;
  const confidence = conf === "low" || conf === "medium" || conf === "high" ? conf : "low";
  return { horizonWeeks, sessionsDelta, confidence, deltaByMetric: x.deltaByMetric };
}

export function normalizeAction(
  a: InsightActionItem,
  knownFactIds: Set<string> = new Set(),
): InsightActionItem {
  const type = a.type;
  const allowedTypes: InsightActionItem["type"][] = ["quick-win", "strategic", "structural"];
  const ice = a.ice;
  const isIce =
    ice &&
    typeof ice.impact === "number" &&
    typeof ice.confidence === "number" &&
    typeof ice.ease === "number";
  const normalizedIce = isIce
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

  const rawProjection = a.projectedImpact;
  let projectedImpact: InsightActionItem["projectedImpact"];
  if (rawProjection && typeof rawProjection === "object") {
    const imp = Array.isArray(rawProjection.ifImplemented)
      ? rawProjection.ifImplemented.map(normalizeProjectionPoint).filter(
          (p): p is InsightProjectionPoint => p !== null,
        )
      : [];
    const nimp = Array.isArray(rawProjection.ifNotImplemented)
      ? rawProjection.ifNotImplemented.map(normalizeProjectionPoint).filter(
          (p): p is InsightProjectionPoint => p !== null,
        )
      : [];
    if (imp.length || nimp.length) {
      projectedImpact = {
        ifImplemented: imp,
        ifNotImplemented: nimp,
        note: typeof rawProjection.note === "string" ? rawProjection.note : undefined,
      };
    }
  }

  return {
    ...a,
    type: type && (allowedTypes as string[]).includes(type) ? type : undefined,
    ice: normalizedIce,
    targetKpi: normalizedKpi,
    leadIndicator: typeof a.leadIndicator === "string" ? a.leadIndicator : undefined,
    risks: Array.isArray(a.risks) ? a.risks : undefined,
    evidenceRefs: clampEvidenceRefs(a.evidenceRefs, knownFactIds),
    projectedImpact,
    critiques: Array.isArray(a.critiques)
      ? a.critiques.filter(
          (c): c is InsightCritique =>
            !!c &&
            typeof c === "object" &&
            typeof (c as InsightCritique).criticism === "string",
        )
      : undefined,
  };
}

export function normalizeDoNotDo(raw: unknown): InsightDoNotDo[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: InsightDoNotDo[] = [];
  raw.forEach((it, i) => {
    if (!it || typeof it !== "object") return;
    const obj = it as InsightDoNotDo;
    if (typeof obj.title !== "string" || typeof obj.reason !== "string") return;
    out.push({
      id: typeof obj.id === "string" ? obj.id : `nd${i + 1}`,
      title: obj.title,
      reason: obj.reason,
      riskIfDone: typeof obj.riskIfDone === "string" ? obj.riskIfDone : undefined,
    });
  });
  return out.length ? out : undefined;
}

export function normalizeTalkingPoints(raw: unknown): InsightTalkingPoints | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as InsightTalkingPoints;
  if (typeof obj.executive3Line !== "string" || !obj.executive3Line.trim()) return undefined;
  return {
    executive3Line: obj.executive3Line,
    fiveMinute: typeof obj.fiveMinute === "string" ? obj.fiveMinute : undefined,
    fifteenMinute: typeof obj.fifteenMinute === "string" ? obj.fifteenMinute : undefined,
    thirtyMinute: typeof obj.thirtyMinute === "string" ? obj.thirtyMinute : undefined,
  };
}

/** A3 Stage 4.5 の出力を Stage4 の actions にマージする */
export function applyStage45(
  actions: InsightActionItem[],
  payload: Stage45Payload,
): { actions: InsightActionItem[]; additionalDoNotDo: InsightDoNotDo[] | undefined } {
  const patchMap = new Map<string, Stage45Payload["actions"][number]>();
  for (const p of payload.actions) {
    if (typeof p.id === "string") patchMap.set(p.id, p);
  }
  const merged = actions.map((a) => {
    const patch = patchMap.get(a.id);
    if (!patch) return a;
    const critiques = Array.isArray(patch.critiques)
      ? patch.critiques.filter(
          (c): c is InsightCritique => !!c && typeof c === "object" && typeof c.criticism === "string",
        )
      : a.critiques;
    const risks = Array.isArray(patch.risks)
      ? Array.from(new Set([...(a.risks ?? []), ...patch.risks]))
      : a.risks;
    const ice = patch.ice
      ? {
          impact: clamp(patch.ice.impact ?? a.ice?.impact ?? 5, 1, 10),
          confidence: clamp(patch.ice.confidence ?? a.ice?.confidence ?? 5, 1, 10),
          ease: clamp(patch.ice.ease ?? a.ice?.ease ?? 5, 1, 10),
          score:
            typeof patch.ice.score === "number"
              ? patch.ice.score
              : Math.round(
                  (clamp(patch.ice.impact ?? a.ice?.impact ?? 5, 1, 10) *
                    clamp(patch.ice.confidence ?? a.ice?.confidence ?? 5, 1, 10) *
                    clamp(patch.ice.ease ?? a.ice?.ease ?? 5, 1, 10)) /
                    10,
                ),
        }
      : a.ice;
    return { ...a, critiques, risks, ice };
  });
  return {
    actions: merged,
    additionalDoNotDo: normalizeDoNotDo(payload.additionalDoNotDo),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function cleanJsonText(json: string): string {
  return json.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

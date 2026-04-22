import type { InsightDiffVsPrevious, InsightIssue, InsightRecord } from "@/types/nis";

const SEV_RANK: Record<InsightIssue["severity"], number> = { high: 3, medium: 2, low: 1 };

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[「」『』【】\[\]\(\)、。・…:：]/g, " ")
    .trim();
}

/** 2 件の issue を「同じ話題」と見なすか判定。タイトルトークンの Jaccard 係数で判定。 */
function sameTopic(a: InsightIssue, b: InsightIssue): boolean {
  if (a.category !== b.category) return false;
  const ta = new Set(normalizeTitle(a.title).split(" ").filter((t) => t.length > 1));
  const tb = new Set(normalizeTitle(b.title).split(" ").filter((t) => t.length > 1));
  const inter = new Set([...ta].filter((t) => tb.has(t)));
  const union = new Set([...ta, ...tb]);
  if (union.size === 0) return false;
  return inter.size / union.size >= 0.4;
}

/**
 * 前回と今回の issues を突合して diff を計算。
 * - new:       前回に同等 issue が無い
 * - resolved:  前回にはあったが今回は無い
 * - worsened:  前回より severity が上がった
 * - persisting: severity 同等以下で継続
 */
export function computeIssueDiff(
  current: InsightIssue[],
  previous: InsightIssue[] | undefined,
  prevInsightSk: string | undefined,
): InsightDiffVsPrevious {
  const prev = previous ?? [];
  const newIssueIds: string[] = [];
  const worsenedIssueIds: string[] = [];
  const persistingIssueIds: string[] = [];
  const matchedPrev = new Set<string>();

  for (const cur of current) {
    const match = prev.find((p) => sameTopic(p, cur) && !matchedPrev.has(p.id));
    if (!match) {
      newIssueIds.push(cur.id);
      continue;
    }
    matchedPrev.add(match.id);
    if (SEV_RANK[cur.severity] > SEV_RANK[match.severity]) {
      worsenedIssueIds.push(cur.id);
    } else {
      persistingIssueIds.push(cur.id);
    }
  }

  const resolvedIssueIds = prev
    .filter((p) => !matchedPrev.has(p.id))
    .map((p) => p.id);

  return {
    prevInsightSk,
    newIssueIds,
    resolvedIssueIds,
    worsenedIssueIds,
    persistingIssueIds,
  };
}

/** 「継続 issue は severity を 1 段上げる」自動アップグレード */
export function upgradeSeverityForRepeated(
  current: InsightIssue[],
  persistingIds: string[],
): InsightIssue[] {
  const persist = new Set(persistingIds);
  return current.map((i) => {
    if (!persist.has(i.id)) return i;
    if (i.severity === "high") return i;
    const next: InsightIssue["severity"] = i.severity === "medium" ? "high" : "medium";
    return { ...i, severity: next, description: `${i.description}（※ 前回レポートからの継続。severity を自動で上げました）` };
  });
}

/** 最新の InsightRecord を 1 件前から抽出 */
export function pickPreviousInsight(
  all: InsightRecord[],
  currentGeneratedAtIso: string,
): InsightRecord | undefined {
  return all.find(
    (r) => r.generatedAtIso < currentGeneratedAtIso && r.type !== "alert" && r.pipeline?.issues,
  );
}

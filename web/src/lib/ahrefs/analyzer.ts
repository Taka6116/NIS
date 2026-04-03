import type { AhrefsKeywordRow, PriorityLevel, ScoredKeyword } from "@/types/nis";

const CATEGORIES: { category: string; patterns: string[] }[] = [
  { category: "ブランド", patterns: ["nihon-teikei", "日本提携", "nihon teikei"] },
  { category: "コンサルティング", patterns: ["コンサル", "consulting", "アドバイザリー"] },
  { category: "DX", patterns: ["dx", "デジタルトランスフォーメーション", "デジタル化"] },
  { category: "ERP", patterns: ["erp", "基幹システム", "sap", "oracle"] },
  { category: "マーケティング", patterns: ["マーケティング", "marketing", "seo", "広告", "リスティング"] },
  { category: "HR/採用", patterns: ["採用", "人事", "hr", "求人", "転職"] },
  { category: "EC", patterns: ["ec", "eコマース", "ショッピング", "通販"] },
  { category: "クラウド", patterns: ["クラウド", "cloud", "saas", "aws", "azure"] },
];

function detectCategory(keyword: string, existing: string): string {
  if (existing && existing !== "—") return existing;
  const lc = keyword.toLowerCase();
  for (const { category, patterns } of CATEGORIES) {
    if (patterns.some((p) => lc.includes(p))) return category;
  }
  return "その他";
}

export function calcOpportunityScore(row: AhrefsKeywordRow): number {
  const volScore = Math.min(row.volume / 1000, 10);
  const kdScore = (100 - row.kd) / 10;
  const cpcBonus = Math.min(row.cpc / 500, 2);
  return Math.round((volScore * 4 + kdScore * 5 + cpcBonus * 1) * 10) / 10;
}

export function detectSvTrend(svTrend: number[]): { trend: "up" | "down" | "stable"; changePercent: number } {
  if (svTrend.length < 4) return { trend: "stable", changePercent: 0 };
  const mid = Math.floor(svTrend.length / 2);
  const recent = svTrend.slice(mid);
  const older = svTrend.slice(0, mid);
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
  const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
  if (avgOlder === 0) return { trend: "stable", changePercent: 0 };
  const pct = Math.round(((avgRecent - avgOlder) / avgOlder) * 100);
  if (pct >= 10) return { trend: "up", changePercent: pct };
  if (pct <= -10) return { trend: "down", changePercent: pct };
  return { trend: "stable", changePercent: pct };
}

function calcPriority(
  score: number,
  kd: number,
  volume: number,
  trend: "up" | "down" | "stable",
): PriorityLevel {
  if (score >= 50 && kd <= 30 && volume >= 100) return 3;
  if (score >= 40 && kd <= 30 && trend === "up") return 3;
  if (score >= 40 && kd <= 50) return 2;
  if (kd <= 20 && volume >= 100) return 2;
  if (score >= 20) return 1;
  return 0;
}

export function analyzeKeywords(keywords: AhrefsKeywordRow[]): ScoredKeyword[] {
  return keywords
    .map((row) => {
      const category = detectCategory(row.keyword, row.category);
      const opportunityScore = calcOpportunityScore({ ...row, category });
      const { trend, changePercent } = detectSvTrend(row.svTrend);
      const priority = calcPriority(opportunityScore, row.kd, row.volume, trend);
      return {
        ...row,
        category,
        opportunityScore,
        priority,
        trend,
        trendChangePercent: changePercent,
      };
    })
    .sort((a, b) => b.priority - a.priority || b.opportunityScore - a.opportunityScore);
}

export function detectTrends(keywords: AhrefsKeywordRow[]): ScoredKeyword[] {
  return analyzeKeywords(keywords).filter((k) => k.trend !== "stable");
}

export function getCategoryCounts(scored: ScoredKeyword[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const k of scored) {
    counts[k.category] = (counts[k.category] ?? 0) + 1;
  }
  return counts;
}

export function mergeAndAnalyze(datasets: { keywords: AhrefsKeywordRow[] }[]): ScoredKeyword[] {
  const all = datasets.flatMap((d) => d.keywords);
  return analyzeKeywords(all);
}

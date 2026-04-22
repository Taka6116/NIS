export type UserRole = "admin" | "member" | "viewer";

export type ProjectRecord = {
  projectId: string;
  projectName: string;
  domain: string;
  gscPropertyUrl: string;
  ga4PropertyId: string;
  clarityProjectId?: string;
  /** Encrypted at rest in production — treat as sensitive */
  clarityApiTokenEncrypted?: string;
  googleServiceSecretRef?: string;
  lastSyncAt?: string;
  lastGscSyncAt?: string;
  lastGa4SyncAt?: string;
  lastClaritySyncAt?: string;
  createdAt: string;
  updatedAt: string;
};

/** GSC: query×page、デバイス×ページ、国別のいずれか */
export type GscRowType = "query" | "device" | "country";

export type GscDailyRow = {
  projectId: string;
  sk: string;
  date: string;
  rowType?: GscRowType;
  query?: string;
  page?: string;
  device?: string;
  country?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/** GA4: メイン（ページ×流入）、チャネル×LP、デバイス×国 */
export type Ga4RowType = "main" | "channel" | "deviceGeo";

export type Ga4DailyRow = {
  projectId: string;
  sk: string;
  date: string;
  rowType?: Ga4RowType;
  pagePath?: string;
  sourceMedium?: string;
  channelGroup?: string;
  landingPage?: string;
  deviceCategory?: string;
  country?: string;
  sessions: number;
  activeUsers: number;
  newUsers: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  conversions: number;
  engagedSessions?: number;
  engagementRate?: number;
  userEngagementDuration?: number;
};

/** Clarity: サイト全体、ページ別、参照元、ブラウザ/端末、国・地域 */
export type ClarityRowKind = "summary" | "page" | "referrer" | "device" | "geo";

export type ClarityDailyRow = {
  projectId: string;
  sk: string;
  date: string;
  rowKind?: ClarityRowKind;
  url?: string;
  /** rowKind referrer のとき */
  referrer?: string;
  clarityBrowser?: string;
  clarityDevice?: string;
  clarityOs?: string;
  traffic: number;
  engagementTime: number;
  scrollDepth: number;
  deadClickCount: number;
  rageClickCount: number;
  scriptErrorCount: number;
  quickbackCount?: number;
  excessiveScrollCount?: number;
  totalPageviews?: number;
  distinctUsers?: number;
  pagesPerSession?: number;
  botSessionCount?: number /** raw count（率は集計側で算出可） */;
};

export type InsightFinding = {
  category: "seo" | "traffic" | "ux" | "conversion";
  severity: "high" | "medium" | "low";
  title: string;
  observation?: string;
  hypothesis?: string;
  risk?: string;
  actions: string[];
  expectedImpact?: string;
  supportingData?: Record<string, unknown>;
};

/** ①現状整理（事実のみ。解釈・原因・推奨を書かない） */
export type InsightFact = {
  id: string;
  statement: string;
  metricRef?: string;
  valueText?: string;
  source?: "gsc" | "ga4" | "clarity" | "rule";
};

/** ②課題 */
export type InsightIssue = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  relatedFactIds: string[];
  category: "seo" | "traffic" | "ux" | "conversion";
};

/** 要因カテゴリ。SEO 監査フレームの 5 階層 + NIS 独自の UX・計測・外部要因。 */
export type InsightFactorCategory =
  | "crawl-index"
  | "technical"
  | "on-page"
  | "content-quality"
  | "authority"
  | "ux-clarity"
  | "tracking"
  | "seasonality-external";

/** ③示唆・仮説 */
export type InsightHypothesisItem = {
  id: string;
  issueId: string;
  statement: string;
  /** データが示す事実と、解釈・仮説の区別 */
  dataSupport: string;
  confidence: "high" | "medium" | "low";
  /** 要因分類（SEO 監査フレーム） */
  factorCategory?: InsightFactorCategory;
  /** 自社改善可能な要因 */
  internalFactors?: string[];
  /** 自社改善不可な外部要因（競合/季節/アルゴリズム等） */
  externalFactors?: string[];
  /** 因果チェーン（例: CTR -2.85pt → クリック -98.4% → セッション -71.6%） */
  mechanism?: string;
  /** 低コスト検証手段 */
  nextValidationStep?: string;
};

/** ④打ち手タイプ */
export type InsightActionType = "quick-win" | "strategic" | "structural";

export type InsightTargetKpi = {
  metric: string;
  direction: "up" | "down";
  /** 相対または絶対値の目標（例: "+15%" / "+200 clicks/日"） */
  targetDelta: string;
  timelineWeeks: number;
};

export type InsightIceScore = {
  /** 1〜10 */
  impact: number;
  /** 1〜10 */
  confidence: number;
  /** 1〜10 */
  ease: number;
  /** Impact × Confidence × Ease / 10（= 0〜100） */
  score: number;
};

/** ④打ち手 */
export type InsightActionItem = {
  id: string;
  hypothesisId: string;
  issueId: string;
  title: string;
  priority: "high" | "medium" | "low";
  effort: string;
  expectedImpact: string;
  steps: string[];
  /** 打ち手タイプ。type ごとに最低 1 件推奨 */
  type?: InsightActionType;
  /** 紐付ける KPI と目標 */
  targetKpi?: InsightTargetKpi;
  /** 先行指標（例: GSC impressions 7 日移動平均） */
  leadIndicator?: string;
  /** ICE スコア */
  ice?: InsightIceScore;
  /** 副作用・リスク */
  risks?: string[];
};

export type InsightPipeline = {
  facts: InsightFact[];
  issues: InsightIssue[];
  hypotheses: InsightHypothesisItem[];
  actions: InsightActionItem[];
};

export type InsightRecord = {
  projectId: string;
  sk: string;
  type: "weekly" | "monthly" | "alert";
  period: { start: string; end: string };
  summary: string;
  findings: InsightFinding[];
  topPriority: { action: string; reason: string };
  /** 4段階パイプライン（新規生成で必須。旧レコードは未設定） */
  pipeline?: InsightPipeline;
  /** LLM 経路（未保存の旧レコードは未設定） */
  modelProvider?: "gemini" | "claude";
  rawPrompt?: string;
  modelVersion?: string;
  tokenUsage?: number;
  generatedAtIso: string;
};

/** Draft レコード（Stage1-2 だけ走った中間状態）。nis-insights テーブルに `sk = "{iso}#draft"` で保存。 */
export type InsightDraftRecord = {
  projectId: string;
  sk: string;
  draftId: string;
  type: "draft";
  period: { start: string; end: string };
  comparison: "previous" | "yoy";
  previousPeriod: { start: string; end: string };
  facts: InsightFact[];
  issues: InsightIssue[];
  modelProvider: "gemini" | "claude";
  modelVersion: string;
  rawPrompt?: string;
  tokenUsage?: number;
  generatedAtIso: string;
  /** DynamoDB TTL 用（epoch seconds） */
  expiresAt: number;
};

export type UserRecord = {
  userId: string;
  email: string;
  name?: string;
  role: UserRole;
  projectIds: string[];
  status?: "active" | "offline";
};

/* ── KW分析（Ahrefs CSV） ── */

export type AhrefsDatasetType = "keywords" | "organic";

export type AhrefsKeywordRow = {
  keyword: string;
  volume: number;
  kd: number;
  cpc: number;
  cps: number;
  parentTopic: string;
  svTrend: number[];
  category: string;
  trafficPotential: number;
  globalVolume: number;
  intents: string;
  position: number | null;
  url: string;
  currentTraffic: number | null;
  trafficChange: number | null;
  branded: boolean;
  serpFeatures: string;
};

export type PriorityLevel = 3 | 2 | 1 | 0;

export type ScoredKeyword = AhrefsKeywordRow & {
  opportunityScore: number;
  priority: PriorityLevel;
  trend: "up" | "down" | "stable";
  trendChangePercent: number;
};

export type AhrefsDataset = {
  id: string;
  projectId: string;
  uploadedAt: string;
  fileName: string;
  rowCount: number;
  type: AhrefsDatasetType;
  keywords: AhrefsKeywordRow[];
};

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

/** ③示唆・仮説 */
export type InsightHypothesisItem = {
  id: string;
  issueId: string;
  statement: string;
  /** データが示す事実と、解釈・仮説の区別 */
  dataSupport: string;
  confidence: "high" | "medium" | "low";
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

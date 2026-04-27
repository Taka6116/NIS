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

/** 季節性ヒント（A8）。Stage1 が YoY / 前期 / トレンドから判定したクラス分け。 */
export type InsightSeasonalityKind =
  | "trend"
  | "seasonal"
  | "residual"
  | "unknown";

export type InsightSeasonalityHint = {
  kind: InsightSeasonalityKind;
  /** 何 % を季節性で説明できるか（0-1）。推定で可。 */
  seasonalShare?: number;
  note?: string;
};

/** ①現状整理（事実のみ。解釈・原因・推奨を書かない） */
export type InsightFact = {
  id: string;
  statement: string;
  metricRef?: string;
  valueText?: string;
  source?: "gsc" | "ga4" | "clarity" | "rule";
  /** A8: 季節性 / トレンド / 残差のラベル（LLM が任意で付ける） */
  seasonalityHint?: InsightSeasonalityHint;
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

/** A5: データ確実性レベル（4 段階 calibration） */
export type InsightDataCertainty =
  | "observed"
  | "single-signal-inferred"
  | "multi-signal-inferred"
  | "speculative";

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
  /** A5: データ確実性の 4 段階 */
  dataCertainty?: InsightDataCertainty;
  /** A1: 参照している fact.id（ハルシネーション抑止） */
  evidenceRefs?: string[];
  /** A2: 生成したペルソナ（SEO / UX / CRO / merged 等） */
  persona?: string;
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

/** A7: Counterfactual KPI 予測（4/8/12 週） */
export type InsightProjectionPoint = {
  horizonWeeks: 4 | 8 | 12;
  /** セッション変化（絶対値 or 近似。LLM が `+2500` や `-1200` 等で出す想定） */
  sessionsDelta: number;
  /** 任意: クリック/CV 等、任意指標の変化 */
  deltaByMetric?: Record<string, number>;
  confidence: "low" | "medium" | "high";
};

export type InsightProjectedImpact = {
  ifImplemented: InsightProjectionPoint[];
  ifNotImplemented: InsightProjectionPoint[];
  note?: string;
};

/** A3 Stage4.5 による批評メモ */
export type InsightCritique = {
  persona: "cfo" | "cmo" | "skeptic";
  criticism: string;
  suggestedAdjust?: string;
};

/** B1: 打ち手ステータス（Kanban） */
export type InsightActionStatus =
  | "todo"
  | "in-progress"
  | "done"
  | "rejected";

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
  /** A1: 根拠 fact.id */
  evidenceRefs?: string[];
  /** A7: 実施/非実施 Counterfactual */
  projectedImpact?: InsightProjectedImpact;
  /** A3 Stage4.5: 懐疑視点の批評 */
  critiques?: InsightCritique[];
  /** KW 連携: この打ち手に紐づくコンテンツ計画（記事/LP 優先リスト）。KW CSV がインポートされている場合のみ出力される。 */
  contentPlan?: {
    recommendedActions: Array<{
      kwTarget: string;
      type: "article" | "lp" | "existing-page-update";
      reason: string;
      estimatedVolumeCapturable?: number;
      priority: "high" | "medium" | "low";
      outline?: string;
    }>;
    doNotTargetKws?: Array<{ kw: string; reason: string }>;
  };
};

/** A6: Not-to-do リスト */
export type InsightDoNotDo = {
  id: string;
  title: string;
  reason: string;
  /** 実行した場合のリスク。LLM に説明させる。 */
  riskIfDone?: string;
};

/** B6: プレゼン粒度別の台本 */
export type InsightTalkingPoints = {
  /** エグゼクティブ 3 行 */
  executive3Line: string;
  /** 5 分版 */
  fiveMinute?: string;
  /** 15 分版 */
  fifteenMinute?: string;
  /** 30 分版 */
  thirtyMinute?: string;
};

/** B2: 前回比の差分（issue 単位） */
export type InsightDiffVsPrevious = {
  prevInsightSk?: string;
  newIssueIds: string[];
  resolvedIssueIds: string[];
  /** 前回の同名 issue の severity より悪化した */
  worsenedIssueIds: string[];
  /** 継続中（前回と同じ or 解消未確定） */
  persistingIssueIds: string[];
};

/** B5: 分析スコープ（セグメント） */
export type InsightSegment = {
  urlPrefix?: string;
  channel?: string;
  country?: string;
  deviceCategory?: string;
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
  /** A6: Not-to-do リスト */
  doNotDo?: InsightDoNotDo[];
  /** B6: 台本の粒度別バリエーション */
  talkingPoints?: InsightTalkingPoints;
  /** B2: 前回との差分 */
  diffVsPrevious?: InsightDiffVsPrevious;
  /** B5: 分析スコープ（未設定はサイト全体） */
  segment?: InsightSegment;
  /** B7: 外部共有トークン（公開 URL 用。発行済みのみ存在） */
  shareToken?: string;
  /** 比較モード */
  comparison?: "previous" | "yoy";
  /** 比較期間 */
  previousPeriod?: { start: string; end: string };
};

/** B1: 打ち手トラッキング（1 action 1 row。テーブル: nis-action-tracking） */
export type ActionTrackingRecord = {
  projectId: string;
  /** sk: `${insightSk}#${actionId}` */
  sk: string;
  insightSk: string;
  actionId: string;
  actionTitle: string;
  status: InsightActionStatus;
  updatedAtIso: string;
  updatedBy?: string;
  implementedAtIso?: string;
  /** 実施後の実績メモ */
  actualImpactNote?: string;
  /** 実施後の実績指標（任意） */
  actualMetrics?: Record<string, number>;
};

/** B8: プロジェクト単位アラート設定（nis-project-alerts） */
export type ProjectAlertConfig = {
  projectId: string;
  sk: "config";
  enabled: boolean;
  /** 監視する指標 */
  rules: Array<{
    id: string;
    metric: string;
    /** 'drop_pct' は変化率（下落%）、'delta_pt' は pt 変化 */
    operator: "drop_pct" | "rise_pct" | "delta_pt";
    threshold: number;
    /** window: 'd7' / 'd28' */
    window: "d7" | "d28";
    severity: "high" | "medium" | "low";
  }>;
  /** Slack incoming webhook */
  slackWebhookUrl?: string;
  /** アラート発火時に自動で Step1 Draft を起動するか */
  autoTriggerDraft?: boolean;
  updatedAtIso: string;
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
  /** Stage3 完了後に中間保存される仮説リスト */
  hypotheses?: InsightHypothesisItem[];
  modelProvider: "gemini" | "claude";
  modelVersion: string;
  rawPrompt?: string;
  tokenUsage?: number;
  generatedAtIso: string;
  /** DynamoDB TTL 用（epoch seconds） */
  expiresAt: number;
  /** B5: 分析スコープ */
  segment?: InsightSegment;
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

/* ── KW サマリ（インサイトパイプライン連携用） ── */

export type KwSummary = {
  topKws: ScoredKeyword[];
  risingKws: ScoredKeyword[];
  categoryCounts: Record<string, number>;
  totalKeywords: number;
  datasetNames: string[];
};

/* ── コンテンツ計画（Stage4 出力の contentPlan フィールド） ── */

export type InsightContentPlanItemType = "article" | "lp" | "existing-page-update";

export type InsightContentPlanItem = {
  kwTarget: string;
  type: InsightContentPlanItemType;
  reason: string;
  estimatedVolumeCapturable?: number;
  priority: "high" | "medium" | "low";
  outline?: string;
};

export type InsightDoNotTargetKw = {
  kw: string;
  reason: string;
};

export type InsightContentPlan = {
  recommendedActions: InsightContentPlanItem[];
  doNotTargetKws?: InsightDoNotTargetKw[];
};

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

export type InsightRecord = {
  projectId: string;
  sk: string;
  type: "weekly" | "monthly" | "alert";
  period: { start: string; end: string };
  summary: string;
  findings: InsightFinding[];
  topPriority: { action: string; reason: string };
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

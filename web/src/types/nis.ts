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

export type GscDailyRow = {
  projectId: string;
  sk: string;
  date: string;
  query?: string;
  page?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  device?: string;
  country?: string;
};

export type Ga4DailyRow = {
  projectId: string;
  sk: string;
  date: string;
  pagePath?: string;
  sourceMedium?: string;
  sessions: number;
  activeUsers: number;
  newUsers: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  conversions: number;
};

export type ClarityDailyRow = {
  projectId: string;
  sk: string;
  date: string;
  url?: string;
  traffic: number;
  engagementTime: number;
  scrollDepth: number;
  deadClickCount: number;
  rageClickCount: number;
  scriptErrorCount: number;
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

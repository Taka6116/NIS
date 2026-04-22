import type {
  AhrefsDataset,
  ClarityDailyRow,
  Ga4DailyRow,
  GscDailyRow,
  InsightDraftRecord,
  InsightRecord,
  ProjectRecord,
  UserRecord,
} from "@/types/nis";

class MockStore {
  projects = new Map<string, ProjectRecord>();
  gsc = new Map<string, GscDailyRow>();
  ga4 = new Map<string, Ga4DailyRow>();
  clarity = new Map<string, ClarityDailyRow>();
  insights = new Map<string, InsightRecord>();
  insightDrafts = new Map<string, InsightDraftRecord>();
  users = new Map<string, UserRecord>();
  kwDatasets = new Map<string, AhrefsDataset>();
}

const globalKey = "__nis_mock_store__" as const;

function getStore(): MockStore {
  const g = globalThis as unknown as { [globalKey]?: MockStore };
  if (!g[globalKey]) g[globalKey] = new MockStore();
  return g[globalKey]!;
}

export const mockStore = {
  get projects() {
    return getStore().projects;
  },
  get gsc() {
    return getStore().gsc;
  },
  get ga4() {
    return getStore().ga4;
  },
  get clarity() {
    return getStore().clarity;
  },
  get insights() {
    return getStore().insights;
  },
  get insightDrafts() {
    return getStore().insightDrafts;
  },
  get users() {
    return getStore().users;
  },
  get kwDatasets() {
    return getStore().kwDatasets;
  },
};

import { listProjects } from "@/lib/dynamodb/repositories/projects";
import { getProjectAlertConfig } from "@/lib/dynamodb/repositories/project-alerts";
import { getMetricsBundleForDates } from "@/lib/metrics/aggregate";
import { runInsightDraft } from "@/lib/insights/run-generate";
import { resolveMetricsWindowOrDefault } from "@/lib/metrics/date-range";
import { format, subDays } from "date-fns";
import { buildAlertFiredMessage, postToSlack, resolveSlackWebhook } from "@/lib/integrations/slack";
import type { ProjectAlertConfig } from "@/types/nis";

function authorize(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.get("authorization");
  return h === `Bearer ${secret}`;
}

type Bundle = Awaited<ReturnType<typeof getMetricsBundleForDates>>;

type ChangeKey = keyof Bundle["change"];
type CurrentKey = keyof Bundle["current"];

function pickMetricValue(
  bundle: Bundle,
  metric: string,
  side: "current" | "change",
): number | undefined {
  if (side === "current") {
    const map = bundle.current as unknown as Record<string, number>;
    return map[metric as CurrentKey as string];
  }
  const map = bundle.change as unknown as Record<string, number>;
  return map[metric as ChangeKey as string];
}

function ruleFires(
  rule: ProjectAlertConfig["rules"][number],
  bundle: Bundle,
): { fired: boolean; observed: number | undefined } {
  // drop_pct: change[metric] <= -threshold
  // rise_pct: change[metric] >= threshold
  // delta_pt: |change[metric]| >= threshold (pt 変化 — bounceRate 等向け)
  const observed = pickMetricValue(bundle, rule.metric, "change");
  if (observed === undefined || !Number.isFinite(observed)) return { fired: false, observed };
  if (rule.operator === "drop_pct") {
    return { fired: observed <= -Math.abs(rule.threshold), observed };
  }
  if (rule.operator === "rise_pct") {
    return { fired: observed >= Math.abs(rule.threshold), observed };
  }
  return { fired: Math.abs(observed) >= Math.abs(rule.threshold), observed };
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "";
  const projects = await listProjects();
  const results: Array<{
    projectId: string;
    fired: Array<{ rule: string; observed: number }>;
    draftId?: string;
    error?: string;
  }> = [];

  for (const p of projects) {
    const cfg = await getProjectAlertConfig(p.projectId);
    if (!cfg || !cfg.enabled) continue;
    try {
      // windows: d7 / d28
      const fired: Array<{ rule: string; observed: number; severity: string }> = [];
      const d7End = format(new Date(), "yyyy-MM-dd");
      const d7Start = format(subDays(new Date(), 6), "yyyy-MM-dd");
      const d28End = d7End;
      const d28Start = format(subDays(new Date(), 27), "yyyy-MM-dd");

      const [b7, b28] = await Promise.all([
        getMetricsBundleForDates(p.projectId, d7Start, d7End),
        getMetricsBundleForDates(p.projectId, d28Start, d28End),
      ]);

      for (const r of cfg.rules) {
        const b = r.window === "d7" ? b7 : b28;
        const { fired: f, observed } = ruleFires(r, b);
        if (f && typeof observed === "number") {
          fired.push({
            rule: `${r.metric} ${r.operator} ${r.threshold}% (${r.window})`,
            observed,
            severity: r.severity,
          });
        }
      }

      let draftId: string | undefined;
      if (fired.length > 0) {
        if (cfg.autoTriggerDraft) {
          try {
            const resolved = resolveMetricsWindowOrDefault({ range: "28d", comparison: "previous" });
            const draft = await runInsightDraft(p.projectId, resolved, "gemini");
            draftId = draft.draftId;
          } catch {
            /* ignore */
          }
        }
        const hook = resolveSlackWebhook(cfg.slackWebhookUrl);
        await postToSlack(
          hook,
          buildAlertFiredMessage({
            projectName: p.projectName,
            ruleDescription: fired
              .map((f) => `${f.rule} → 実測 ${f.observed.toFixed(1)}%（${f.severity}）`)
              .join(" / "),
            dashboardUrl: `${appUrl}/projects/${p.projectId}`,
            autoTriggered: Boolean(draftId),
            draftUrl: draftId
              ? `${appUrl}/projects/${p.projectId}/insights/drafts/${draftId}`
              : undefined,
          }),
        );
      }

      results.push({
        projectId: p.projectId,
        fired: fired.map((f) => ({ rule: f.rule, observed: f.observed })),
        draftId,
      });
    } catch (e) {
      results.push({
        projectId: p.projectId,
        fired: [],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return Response.json({ ok: true, results });
}

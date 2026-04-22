import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { AlertSettingsForm } from "@/components/insights/alert-settings-form";
import { auth } from "@/auth";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import {
  defaultAlertConfig,
  getProjectAlertConfig,
} from "@/lib/dynamodb/repositories/project-alerts";
import { detectAnomalies } from "@/lib/insights/anomaly";
import { notFound } from "next/navigation";

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();
  const session = await auth();

  const [existing, anomalies] = await Promise.all([
    getProjectAlertConfig(projectId),
    detectAnomalies(projectId).catch(() => []),
  ]);
  const config = existing ?? defaultAlertConfig(projectId);

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="アラート & 異常値"
        subtitle={`${project.projectName} — 日次で指標を監視し閾値を超えた際に通知/自動分析を走らせる`}
        userEmail={session?.user?.email}
      />

      <div className="mt-6 space-y-6">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">直近 45 日の異常値（Z-Score ≧ 2.0）</h2>
            <span className="text-[10px] text-slate-500">{anomalies.length} 件</span>
          </div>
          {anomalies.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">現時点で有意な異常値はありません。</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-1.5">Date</th>
                    <th className="py-1.5">Metric</th>
                    <th className="py-1.5">Value</th>
                    <th className="py-1.5">Mean</th>
                    <th className="py-1.5">Z</th>
                    <th className="py-1.5">方向</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {anomalies.map((a) => (
                    <tr key={`${a.metric}-${a.date}`} className="text-slate-200">
                      <td className="py-1.5">{a.date}</td>
                      <td className="py-1.5">{a.metric}</td>
                      <td className="py-1.5">{a.value.toLocaleString()}</td>
                      <td className="py-1.5">{a.mean.toFixed(1)}</td>
                      <td
                        className={
                          "py-1.5 " +
                          (Math.abs(a.zScore) >= 3 ? "text-rose-300" : "text-amber-300")
                        }
                      >
                        {a.zScore.toFixed(2)}
                      </td>
                      <td className="py-1.5">{a.direction === "up" ? "↑ 急増" : "↓ 急減"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <AlertSettingsForm projectId={projectId} initial={config} />
      </div>
    </main>
  );
}

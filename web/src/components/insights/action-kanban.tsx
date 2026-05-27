"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { ActionTrackingRecord, InsightActionStatus } from "@/types/nis";
import Link from "next/link";

type ActionSeed = {
  insightSk: string;
  actionId: string;
  title: string;
  issueTitle?: string;
  priority?: "high" | "medium" | "low";
  generatedAtIso: string;
  iceScore?: number;
};

type Props = {
  projectId: string;
  seeds: ActionSeed[];
  initialRows: ActionTrackingRecord[];
};

const COLUMNS: Array<{ id: InsightActionStatus; label: string; color: string }> = [
  { id: "todo", label: "未着手", color: "border-slate-500/40" },
  { id: "in-progress", label: "実施中", color: "border-sky-400/50" },
  { id: "done", label: "実施済", color: "border-emerald-400/50" },
  { id: "rejected", label: "却下", color: "border-rose-400/50" },
];

export function ActionKanban({ projectId, seeds, initialRows }: Props) {
  const [rows, setRows] = useState<ActionTrackingRecord[]>(initialRows);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; note: string } | null>(null);

  const rowMap = useMemo(() => {
    const m = new Map<string, ActionTrackingRecord>();
    for (const r of rows) m.set(r.sk, r);
    return m;
  }, [rows]);

  const getStatusFor = useCallback(
    (seed: ActionSeed): InsightActionStatus => {
      const sk = `${seed.insightSk}#${seed.actionId}`;
      return rowMap.get(sk)?.status ?? "todo";
    },
    [rowMap],
  );

  const changeStatus = useCallback(
    async (seed: ActionSeed, next: InsightActionStatus) => {
      const sk = `${seed.insightSk}#${seed.actionId}`;
      setBusyKey(sk);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/action-tracking`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            insightSk: seed.insightSk,
            actionId: seed.actionId,
            actionTitle: seed.title,
            status: next,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `HTTP ${res.status}`);
        }
        const j = await res.json();
        setRows((prev) => {
          const exists = prev.some((r) => r.sk === sk);
          return exists ? prev.map((r) => (r.sk === sk ? j.row : r)) : [...prev, j.row];
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyKey(null);
      }
    },
    [projectId],
  );

  const saveNote = useCallback(
    async (seed: ActionSeed, note: string) => {
      const sk = `${seed.insightSk}#${seed.actionId}`;
      setBusyKey(sk);
      setError(null);
      try {
        const current = rowMap.get(sk);
        const res = await fetch(`/api/projects/${projectId}/action-tracking`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            insightSk: seed.insightSk,
            actionId: seed.actionId,
            actionTitle: seed.title,
            status: current?.status ?? "done",
            actualImpactNote: note,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `HTTP ${res.status}`);
        }
        const j = await res.json();
        setRows((prev) => {
          const exists = prev.some((r) => r.sk === sk);
          return exists ? prev.map((r) => (r.sk === sk ? j.row : r)) : [...prev, j.row];
        });
        setEditing(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyKey(null);
      }
    },
    [projectId, rowMap],
  );

  const bySeed = useMemo(() => {
    const g: Record<InsightActionStatus, ActionSeed[]> = {
      todo: [],
      "in-progress": [],
      done: [],
      rejected: [],
    };
    for (const s of seeds) {
      g[getStatusFor(s)].push(s);
    }
    return g;
  }, [seeds, getStatusFor]);

  return (
    <div className="space-y-4">
      {error ? (
        <Card className="border-rose-400/30 bg-rose-500/10">
          <p className="text-xs text-rose-200">エラー: {error}</p>
        </Card>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = bySeed[col.id];
          return (
            <div
              key={col.id}
              className={"flex flex-col gap-3 rounded-xl border bg-white/5 p-3 " + col.color}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {col.label}
                </div>
                <div className="text-[10px] text-slate-500">{items.length} 件</div>
              </div>
              <div className="flex flex-col gap-2">
                {items.length === 0 ? (
                  <p className="text-[11px] text-slate-500">なし</p>
                ) : (
                  items.map((s) => {
                    const sk = `${s.insightSk}#${s.actionId}`;
                    const rec = rowMap.get(sk);
                    const busy = busyKey === sk;
                    return (
                      <div
                        key={sk}
                        className={`rounded-lg border border-white/10 bg-[#0f141d] p-3 text-xs transition-opacity ${busy ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase tracking-wide text-slate-500">
                            {s.generatedAtIso.slice(0, 10)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {busy && <LoadingSpinner variant="ring" size="xs" className="text-cyan-400" />}
                            {s.priority ? (
                              <span
                                className={
                                  "rounded px-1.5 py-0.5 text-[9px] " +
                                  (s.priority === "high"
                                    ? "bg-rose-500/20 text-rose-200"
                                    : s.priority === "medium"
                                      ? "bg-amber-500/20 text-amber-200"
                                      : "bg-slate-500/20 text-slate-300")
                                }
                              >
                                {s.priority}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-1.5 text-[13px] font-medium text-white">{s.title}</p>
                        {s.issueTitle ? (
                          <p className="mt-1 text-[10px] text-slate-500">課題: {s.issueTitle}</p>
                        ) : null}
                        {typeof s.iceScore === "number" ? (
                          <p className="mt-1 text-[10px] text-cyan-300">ICE {s.iceScore.toFixed(1)}</p>
                        ) : null}
                        <Link
                          href={`/projects/${projectId}/insights/${encodeURIComponent(s.insightSk)}`}
                          className="mt-1 block text-[10px] text-sky-300 hover:text-sky-200"
                        >
                          元のインサイトを見る →
                        </Link>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {COLUMNS.filter((c) => c.id !== col.id).map((c) => (
                            <Button
                              key={c.id}
                              variant="outline"
                              className="h-6 rounded px-2 text-[10px]"
                              disabled={busy}
                              onClick={() => changeStatus(s, c.id)}
                            >
                              → {c.label}
                            </Button>
                          ))}
                        </div>
                        {col.id === "done" ? (
                          <div className="mt-2 rounded border border-white/5 bg-white/5 p-2">
                            {editing?.key === sk ? (
                              <div>
                                <textarea
                                  className="w-full rounded bg-black/30 p-1.5 text-[11px] text-slate-100"
                                  rows={2}
                                  value={editing.note}
                                  onChange={(e) => setEditing({ key: sk, note: e.target.value })}
                                />
                                <div className="mt-1 flex gap-1">
                                  <Button
                                    className="h-6 min-w-[4rem] rounded px-2 text-[10px]"
                                    disabled={busy}
                                    onClick={() => saveNote(s, editing.note)}
                                  >
                                    {busy ? <LoadingSpinner variant="ring" size="xs" /> : "保存"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="h-6 rounded px-2 text-[10px]"
                                    onClick={() => setEditing(null)}
                                  >
                                    キャンセル
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-[10px] text-slate-400">
                                  実績メモ
                                  {rec?.implementedAtIso ? (
                                    <span className="ml-1 text-slate-500">
                                      (実施 {rec.implementedAtIso.slice(0, 10)})
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-200">
                                  {rec?.actualImpactNote || "（未入力）"}
                                </p>
                                <button
                                  type="button"
                                  className="mt-1 text-[10px] text-cyan-300 hover:text-cyan-200"
                                  onClick={() =>
                                    setEditing({
                                      key: sk,
                                      note: rec?.actualImpactNote ?? "",
                                    })
                                  }
                                >
                                  編集
                                </button>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KwUploadZone } from "@/components/keywords/kw-upload-zone";
import { KwSummaryCards } from "@/components/keywords/kw-summary-cards";
import { KwFilterPills } from "@/components/keywords/kw-filter-pills";
import { KwDataTable } from "@/components/keywords/kw-data-table";
import { parseAhrefsCSV, decodeCSVBuffer } from "@/lib/ahrefs/csv-parser";
import { analyzeKeywords, mergeAndAnalyze, detectTrends } from "@/lib/ahrefs/analyzer";
import { Search, X } from "lucide-react";
import type { AhrefsDataset, PriorityLevel, ScoredKeyword } from "@/types/nis";

type TabKey = "opportunity" | "organic" | "trends" | "all";
const PAGE_SIZE = 50;

export default function KeywordsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { data: session } = useSession();

  const [datasets, setDatasets] = useState<AhrefsDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("opportunity");
  const [selectedPriority, setSelectedPriority] = useState<"all" | PriorityLevel>("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCount, setShowCount] = useState(PAGE_SIZE);

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/keywords`);
      if (res.ok) {
        const j = (await res.json()) as { datasets: AhrefsDataset[] };
        setDatasets(j.datasets);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  useEffect(() => {
    setShowCount(PAGE_SIZE);
    setSelectedPriority("all");
    setSelectedCategory("all");
  }, [activeTab]);

  const handleFiles = useCallback(
    async (files: FileList) => {
      setUploading(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const csvText = decodeCSVBuffer(bytes);
          const { keywords, type } = parseAhrefsCSV(csvText);
          const id = crypto.randomUUID();
          const dataset: AhrefsDataset = {
            id,
            projectId,
            uploadedAt: new Date().toISOString(),
            fileName: file.name,
            rowCount: keywords.length,
            type,
            keywords,
          };
          const res = await fetch(`/api/projects/${projectId}/keywords`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dataset),
          });
          if (!res.ok) throw new Error("保存に失敗しました");
          setDatasets((prev) => [dataset, ...prev]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "CSVの処理に失敗しました");
      } finally {
        setUploading(false);
      }
    },
    [projectId],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await fetch(`/api/projects/${projectId}/keywords?id=${id}`, { method: "DELETE" });
      setDatasets((prev) => prev.filter((d) => d.id !== id));
    },
    [projectId],
  );

  const kwData = useMemo(() => datasets.filter((d) => d.type === "keywords"), [datasets]);
  const orgData = useMemo(() => datasets.filter((d) => d.type === "organic"), [datasets]);

  const activeData: ScoredKeyword[] = useMemo(() => {
    switch (activeTab) {
      case "opportunity":
        return mergeAndAnalyze(kwData);
      case "organic":
        return mergeAndAnalyze(orgData);
      case "trends":
        return detectTrends(datasets.flatMap((d) => d.keywords));
      case "all":
        return mergeAndAnalyze(datasets);
    }
  }, [activeTab, datasets, kwData, orgData]);

  const filtered = useMemo(() => {
    let list = activeData;
    if (selectedPriority !== "all") {
      list = list.filter((k) => k.priority === selectedPriority);
    }
    if (selectedCategory !== "all") {
      list = list.filter((k) => k.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((k) => k.keyword.toLowerCase().includes(q));
    }
    return list;
  }, [activeData, selectedPriority, selectedCategory, searchQuery]);

  const TABS: { key: TabKey; label: string }[] = [
    { key: "opportunity", label: "狙い目 KW" },
    { key: "organic", label: "競合 KW" },
    { key: "trends", label: "トレンド" },
    { key: "all", label: "全データ" },
  ];

  return (
    <main
      className="min-w-0 flex-1 p-8"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <AppHeader
          title="KW 分析ダッシュボード"
          subtitle="Ahrefs CSV をインポートしてキーワードの狙い目・競合・トレンドを分析します。"
          userEmail={session?.user?.email ?? null}
        />
        <KwUploadZone onFiles={handleFiles} uploading={uploading} />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Dataset badges */}
      {datasets.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {datasets.map((ds) => (
            <span
              key={ds.id}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                ds.type === "organic"
                  ? "bg-violet-500/15 text-violet-300 ring-violet-400/25"
                  : "bg-cyan-500/15 text-cyan-300 ring-cyan-400/25"
              }`}
            >
              {ds.fileName} ({ds.rowCount})
              <button onClick={() => handleDelete(ds.id)} className="ml-0.5 opacity-50 hover:opacity-100">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="mt-16 text-center text-sm text-slate-500">読み込み中…</div>
      ) : datasets.length === 0 ? (
        <Card className="mt-8 flex flex-col items-center gap-4 py-16">
          <p className="text-sm text-slate-400">まだデータがありません。Ahrefs の CSV をインポートしてください。</p>
          <KwUploadZone onFiles={handleFiles} uploading={uploading} />
        </Card>
      ) : (
        <>
          <div className="mt-6">
            <KwSummaryCards data={activeData} />
          </div>

          <div className="mt-4">
            <KwFilterPills
              data={activeData}
              selectedPriority={selectedPriority}
              onPriorityChange={setSelectedPriority}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 border-b border-white/10">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? "border-b-2 border-cyan-400 text-cyan-200"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="キーワードを検索…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Card className="mt-4">
            <KwDataTable
              data={filtered}
              showCount={showCount}
              isOrganic={activeTab === "organic"}
            />
            {showCount < filtered.length && (
              <div className="mt-4 text-center">
                <Button variant="outline" className="text-xs" onClick={() => setShowCount((c) => c + PAGE_SIZE)}>
                  さらに {Math.min(PAGE_SIZE, filtered.length - showCount)} 件表示
                </Button>
              </div>
            )}
          </Card>
        </>
      )}
    </main>
  );
}

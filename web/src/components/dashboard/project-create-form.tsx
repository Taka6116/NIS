"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProjectCreateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      projectName: String(fd.get("projectName") ?? ""),
      domain: String(fd.get("domain") ?? ""),
      gscPropertyUrl: String(fd.get("gscPropertyUrl") ?? ""),
      ga4PropertyId: String(fd.get("ga4PropertyId") ?? ""),
      clarityProjectId: String(fd.get("clarityProjectId") ?? "") || undefined,
    };
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      setError("作成に失敗しました。入力内容と API 設定を確認してください。");
      return;
    }
    const json = (await res.json()) as { project: { projectId: string } };
    router.push(`/projects/${json.project.projectId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="projectName">プロジェクト名</Label>
        <Input id="projectName" name="projectName" required placeholder="観光協会サイト" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="domain">ドメイン</Label>
        <Input id="domain" name="domain" required placeholder="example.jp" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ga4PropertyId">GA4 Property ID</Label>
        <Input id="ga4PropertyId" name="ga4PropertyId" required placeholder="123456789" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="gscPropertyUrl">Search Console プロパティURL</Label>
        <Input id="gscPropertyUrl" name="gscPropertyUrl" required placeholder="sc-domain:example.jp または https://..." />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="clarityProjectId">Clarity Project ID（任意）</Label>
        <Input id="clarityProjectId" name="clarityProjectId" placeholder="xxxxxxxx" />
      </div>
      {error ? <p className="md:col-span-2 text-sm text-rose-300">{error}</p> : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending} className="min-w-[10rem]">
          {pending ? (
            <>
              <LoadingSpinner variant="ring" size="sm" />
              作成中…
            </>
          ) : (
            "プロジェクトを作成"
          )}
        </Button>
      </div>
    </form>
  );
}

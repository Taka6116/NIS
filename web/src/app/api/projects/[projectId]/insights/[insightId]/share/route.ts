import { getSessionUserRole, requireSession, isAuthError } from "@/lib/rbac";
import {
  deleteShare,
  generateShareToken,
  putShare,
} from "@/lib/dynamodb/repositories/insight-shares";
import { getInsight, putInsight } from "@/lib/dynamodb/repositories/insights";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string; insightId: string }> },
) {
  try {
    await requireSession();
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const meta = await getSessionUserRole();
  if (!meta || (meta.role !== "admin" && meta.role !== "member")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { projectId, insightId } = await ctx.params;
  const sk = decodeURIComponent(insightId);
  const insight = await getInsight(projectId, sk);
  if (!insight) return Response.json({ error: "Not Found" }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  const expiresAt =
    typeof body.expiresInDays === "number" && body.expiresInDays > 0
      ? Math.floor(Date.now() / 1000) + body.expiresInDays * 86_400
      : undefined;

  // 既存トークンがあれば回収
  if (insight.shareToken) await deleteShare(insight.shareToken).catch(() => {});

  const token = generateShareToken();
  await putShare({ token, projectId, sk, createdAt: new Date().toISOString(), expiresAt });
  await putInsight({ ...insight, shareToken: token });

  return Response.json({
    ok: true,
    token,
    shareUrl: `/share/${token}`,
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; insightId: string }> },
) {
  try {
    await requireSession();
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const meta = await getSessionUserRole();
  if (!meta || (meta.role !== "admin" && meta.role !== "member")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { projectId, insightId } = await ctx.params;
  const sk = decodeURIComponent(insightId);
  const insight = await getInsight(projectId, sk);
  if (!insight) return Response.json({ error: "Not Found" }, { status: 404 });
  if (insight.shareToken) {
    await deleteShare(insight.shareToken).catch(() => {});
    const { shareToken: _unused, ...rest } = insight;
    void _unused;
    await putInsight({ ...rest });
  }
  return Response.json({ ok: true });
}

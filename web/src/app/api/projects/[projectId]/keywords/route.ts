import { putKwDataset, listKwDatasets, deleteKwDataset } from "@/lib/dynamodb/repositories/kw-datasets";
import { requireProjectAccess, isAuthError } from "@/lib/rbac";
import type { AhrefsDataset } from "@/types/nis";

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  try {
    await requireProjectAccess(projectId, ["viewer", "member", "admin"]);
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: (e as { message: string }).message }, { status: (e as { status: number }).status });
    throw e;
  }
  const datasets = await listKwDatasets(projectId);
  return Response.json({ datasets });
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  try {
    await requireProjectAccess(projectId, ["member", "admin"]);
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: (e as { message: string }).message }, { status: (e as { status: number }).status });
    throw e;
  }
  const body = (await req.json()) as AhrefsDataset;
  if (!body.id || !body.keywords?.length) {
    return Response.json({ error: "Invalid dataset" }, { status: 400 });
  }
  const dataset: AhrefsDataset = { ...body, projectId };
  try {
    await putKwDataset(dataset);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const name = e instanceof Error ? e.name : "Error";
    console.error("[api/keywords POST] failed:", e);
    return Response.json({ error: msg, code: name }, { status: 500 });
  }
  return Response.json({ status: "ok", id: dataset.id });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  try {
    await requireProjectAccess(projectId, ["member", "admin"]);
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: (e as { message: string }).message }, { status: (e as { status: number }).status });
    throw e;
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    await deleteKwDataset(projectId, id);
  } else {
    const all = await listKwDatasets(projectId);
    for (const ds of all) {
      await deleteKwDataset(projectId, ds.id);
    }
  }
  return Response.json({ status: "ok" });
}


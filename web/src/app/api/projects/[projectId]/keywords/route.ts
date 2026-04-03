import { putKwDataset, listKwDatasets, deleteKwDataset } from "@/lib/dynamodb/repositories/kw-datasets";
import { requireSession, getSessionUserRole, isAuthError } from "@/lib/rbac";
import type { AhrefsDataset } from "@/types/nis";

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    await requireSession();
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: (e as { message: string }).message }, { status: 401 });
    throw e;
  }
  const { projectId } = await ctx.params;
  const datasets = await listKwDatasets(projectId);
  return Response.json({ datasets });
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    await requireSession();
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: (e as { message: string }).message }, { status: 401 });
    throw e;
  }
  const meta = await getSessionUserRole();
  if (!meta || (meta.role !== "admin" && meta.role !== "member")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { projectId } = await ctx.params;
  const body = (await req.json()) as AhrefsDataset;
  if (!body.id || !body.keywords?.length) {
    return Response.json({ error: "Invalid dataset" }, { status: 400 });
  }
  const dataset: AhrefsDataset = { ...body, projectId };
  await putKwDataset(dataset);
  return Response.json({ status: "ok", id: dataset.id });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    await requireSession();
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: (e as { message: string }).message }, { status: 401 });
    throw e;
  }
  const meta = await getSessionUserRole();
  if (!meta || (meta.role !== "admin" && meta.role !== "member")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { projectId } = await ctx.params;
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

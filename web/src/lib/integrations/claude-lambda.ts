import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { RuleAlert } from "@/lib/insights/rules";
import type { KpiSnapshot } from "@/lib/metrics/aggregate";
import type { InsightPipeline } from "@/types/nis";

/** Lambda に渡すペイロード（設計書 9 章と同型） */
export type InsightLambdaInput = {
  version: 1;
  projectName: string;
  domain: string;
  periodLabel: string;
  current: KpiSnapshot;
  previous: KpiSnapshot;
  change: Record<string, number>;
  alerts: RuleAlert[];
  clarityNote?: string;
};

export type InsightLambdaSuccessOutput = {
  ok: true;
  pipeline: InsightPipeline;
  summary: string;
  topPriority: { action: string; reason: string };
  rawJoined: string;
  modelId: string;
  tokenUsage?: number;
};

export type InsightLambdaErrorOutput = {
  ok: false;
  errorCode: string;
  message: string;
};

export type InsightLambdaOutput = InsightLambdaSuccessOutput | InsightLambdaErrorOutput;

export async function invokeInsightClaudeLambda(input: InsightLambdaInput): Promise<InsightLambdaSuccessOutput> {
  const name = process.env.INSIGHT_CLAUDE_LAMBDA_FUNCTION_NAME;
  if (!name?.trim()) {
    throw new Error(
      "INSIGHT_CLAUDE_LAMBDA_FUNCTION_NAME is not set. Deploy lambda/insight-claude and configure this env var.",
    );
  }
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
  const client = new LambdaClient({ region });

  const res = await client.send(
    new InvokeCommand({
      FunctionName: name,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(JSON.stringify(input), "utf-8"),
    }),
  );

  if (res.FunctionError) {
    const raw = res.Payload ? Buffer.from(res.Payload).toString("utf-8") : "";
    throw new Error(`Lambda FunctionError: ${res.FunctionError} ${raw.slice(0, 500)}`);
  }

  if (!res.Payload?.length) {
    throw new Error("Lambda returned empty payload");
  }

  const text = Buffer.from(res.Payload).toString("utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Lambda returned non-JSON: ${text.slice(0, 200)}`);
  }

  const out = parsed as InsightLambdaOutput;
  if (!out || typeof out !== "object") {
    throw new Error("Invalid Lambda response");
  }
  if (!("ok" in out)) {
    throw new Error(`Lambda response missing ok: ${text.slice(0, 300)}`);
  }
  if (!out.ok) {
    throw new Error((out as InsightLambdaErrorOutput).message || "Claude pipeline failed");
  }

  const ok = out as InsightLambdaSuccessOutput;
  if (!ok.pipeline || !ok.summary || !ok.topPriority) {
    throw new Error("Lambda success payload missing pipeline/summary/topPriority");
  }
  return ok;
}

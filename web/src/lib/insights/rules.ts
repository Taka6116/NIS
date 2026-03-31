import type { KpiSnapshot } from "@/lib/metrics/aggregate";

export type RuleAlert = { code: string; message: string; severity: "high" | "medium" | "low" };

export function runRules(input: {
  current: KpiSnapshot;
  previous: KpiSnapshot;
  change: {
    sessions: number;
    impressions: number;
    ctr: number;
    avgPosition: number;
    bounceRate: number;
    conversions: number;
  };
}): RuleAlert[] {
  const alerts: RuleAlert[] = [];
  const { current, previous, change } = input;

  if (current.ctr < 0.02 && current.impressions > 100) {
    alerts.push({
      code: "CTR_LOW",
      message: `CTR が ${(current.ctr * 100).toFixed(2)}% と低く、表示回数は ${current.impressions.toLocaleString()} です。タイトル / メタの見直し候補です。`,
      severity: "medium",
    });
  }

  if (change.impressions > 30 && current.ctr < previous.ctr * 0.85 && previous.ctr > 0) {
    alerts.push({
      code: "IMPR_UP_CTR_DOWN",
      message:
        "表示は増えている一方で CTR が下がっています。検索意図とタイトルのズレ、または意図のブレが疑われます。",
      severity: "high",
    });
  }

  if (change.avgPosition > 3) {
    alerts.push({
      code: "POSITION_DOWN",
      message: `平均掲載順位が約 ${change.avgPosition.toFixed(1)} 位悪化しています。主要クエリごとの順位要因確認を推奨します。`,
      severity: "high",
    });
  }

  if (change.sessions < -20) {
    alerts.push({
      code: "SESSIONS_DROP",
      message: `セッションが前週比で約 ${change.sessions.toFixed(1)}% 減少しています。チャネル別の内訳確認が必要です。`,
      severity: "high",
    });
  }

  if (current.bounceRate > 0.7) {
    alerts.push({
      code: "BOUNCE_HIGH",
      message: `直帰率が ${(current.bounceRate * 100).toFixed(1)}% と高いです。ランディングページのファーストビュー改善を検討してください。`,
      severity: "medium",
    });
  }

  if (change.conversions < -15 && previous.conversions > 0) {
    alerts.push({
      code: "CV_DROP",
      message: "コンバージョンが大きく落ち込んでいます。計測設定と主要導線の双方を確認してください。",
      severity: "high",
    });
  }

  if (current.clicks < previous.clicks * 0.95 && Math.abs(change.impressions) < 5) {
    alerts.push({
      code: "CLICKS_DOWN_IMPRESSIONS_FLAT",
      message: "表示は横ばいなのにクリックが減少しています。SERP 上での訴求弱体化（CTR低下）の可能性があります。",
      severity: "medium",
    });
  }

  return alerts;
}

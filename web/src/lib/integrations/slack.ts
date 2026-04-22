/** Slack Incoming Webhook への軽量 POST。webhook 未設定時は no-op。 */

export type SlackBlock =
  | { type: "section"; text: { type: "mrkdwn"; text: string } }
  | { type: "divider" }
  | { type: "context"; elements: Array<{ type: "mrkdwn"; text: string }> }
  | {
      type: "actions";
      elements: Array<{
        type: "button";
        text: { type: "plain_text"; text: string };
        url: string;
        style?: "primary" | "danger";
      }>;
    };

export type SlackMessage = {
  text: string;
  blocks?: SlackBlock[];
};

export async function postToSlack(webhookUrl: string | undefined, message: SlackMessage): Promise<void> {
  if (!webhookUrl) return;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      console.warn("[slack] failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.warn("[slack] post error:", e);
  }
}

export function resolveSlackWebhook(projectWebhook: string | undefined): string | undefined {
  return projectWebhook?.trim() || process.env.SLACK_WEBHOOK_URL?.trim() || undefined;
}

/** Draft 完了 → Reviewer 通知 */
export function buildDraftReadyMessage(opts: {
  projectName: string;
  periodLabel: string;
  issueCount: number;
  reviewUrl: string;
}): SlackMessage {
  const text = `🟡 *NIS Draft 準備完了* — ${opts.projectName} / ${opts.periodLabel} / ${opts.issueCount} 件の課題`;
  return {
    text,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${opts.projectName}* の Step1（現状・課題）が完了しました。\n期間: ${opts.periodLabel}\n課題数: *${opts.issueCount}*`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "レビューして Step2 へ" },
            url: opts.reviewUrl,
            style: "primary",
          },
        ],
      },
    ],
  };
}

/** Finalize 完了 → 最終レポート通知 */
export function buildFinalizeReadyMessage(opts: {
  projectName: string;
  periodLabel: string;
  topPriority: string;
  reportUrl: string;
}): SlackMessage {
  const text = `✅ *NIS 分析完了* — ${opts.projectName} / ${opts.periodLabel}`;
  return {
    text,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${opts.projectName}* の分析レポートが完成しました。\n期間: ${opts.periodLabel}\n最優先アクション: *${opts.topPriority}*`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "レポートを開く" },
            url: opts.reportUrl,
            style: "primary",
          },
        ],
      },
    ],
  };
}

/** B8 アラート発火通知 */
export function buildAlertFiredMessage(opts: {
  projectName: string;
  ruleDescription: string;
  dashboardUrl: string;
  autoTriggered?: boolean;
  draftUrl?: string;
}): SlackMessage {
  const text = `🔔 *NIS KPI アラート* — ${opts.projectName} / ${opts.ruleDescription}`;
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${opts.projectName}*\nアラート: ${opts.ruleDescription}\n${opts.autoTriggered ? "自動で Step1 Draft を起動しました。" : ""}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "ダッシュボードを開く" },
          url: opts.dashboardUrl,
        },
        ...(opts.draftUrl
          ? [
              {
                type: "button" as const,
                text: { type: "plain_text" as const, text: "Draft を開く" },
                url: opts.draftUrl,
                style: "primary" as const,
              },
            ]
          : []),
      ],
    },
  ];
  return { text, blocks };
}

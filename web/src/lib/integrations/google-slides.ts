import { google } from "googleapis";
import { getServiceAccountCredentials } from "@/lib/integrations/google-credentials";

type CreateSlidesInput = {
  title: string;
  /**
   * 区切り線 "===" で分割されたスライド骨子。各ブロック 1 枚のスライドになる。
   * 1 行目をタイトル、以降を本文として扱う。
   */
  outlineText: string;
};

type CreateSlidesOutput = {
  presentationId: string;
  url: string;
};

function splitSlides(outline: string): Array<{ title: string; body: string }> {
  // "===" 行で区切る
  const blocks = outline
    .split(/\n=+\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  // 更に「スライド N: タイトル」パターンから分割
  const slides: Array<{ title: string; body: string }> = [];
  for (const block of blocks) {
    const m = block.match(/^\s*スライド\s*\d+\s*[:：]\s*(.+)$/m);
    if (m) {
      const title = m[1].trim();
      const body = block.replace(m[0], "").trim();
      slides.push({ title, body });
      continue;
    }
    const [firstLine, ...rest] = block.split("\n");
    slides.push({ title: firstLine.slice(0, 80), body: rest.join("\n").trim() });
  }
  if (slides.length === 0) {
    slides.push({ title: "NIS Insight", body: outline });
  }
  return slides.slice(0, 40);
}

function authClient() {
  const cred = getServiceAccountCredentials();
  if (!cred) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON not set. Service account with drive + slides scopes required.",
    );
  }
  return new google.auth.JWT({
    email: cred.client_email,
    key: cred.private_key,
    scopes: ["https://www.googleapis.com/auth/presentations", "https://www.googleapis.com/auth/drive"],
  });
}

/**
 * Google Slides をサービスアカウントで作成する。
 *
 * 注意: サービスアカウントが作成したファイルはドライブ上でそのアカウント所有になる。
 * そのため `GOOGLE_SLIDES_SHARE_EMAIL`（通常は発行者）を明示して writer 権限で共有する。
 */
export async function createSlidesFromOutline({
  title,
  outlineText,
}: CreateSlidesInput): Promise<CreateSlidesOutput> {
  const auth = authClient();
  await auth.authorize();
  const slidesApi = google.slides({ version: "v1", auth });
  const driveApi = google.drive({ version: "v3", auth });

  // 1. create presentation
  const presRes = await slidesApi.presentations.create({ requestBody: { title } });
  const presentationId = presRes.data.presentationId;
  if (!presentationId) throw new Error("Failed to create presentation");

  // 2. share (任意)
  const shareEmail = process.env.GOOGLE_SLIDES_SHARE_EMAIL?.trim();
  if (shareEmail) {
    await driveApi.permissions.create({
      fileId: presentationId,
      requestBody: { type: "user", role: "writer", emailAddress: shareEmail },
      sendNotificationEmail: false,
    });
  }

  // 3. 既存の 1 枚目スライドはそのまま使い、残りを追加
  const slides = splitSlides(outlineText);

  const pres = await slidesApi.presentations.get({ presentationId });
  const firstSlideId = pres.data.slides?.[0]?.objectId ?? undefined;

  const requests: import("googleapis").slides_v1.Schema$Request[] = [];
  const pageIds: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const pageId = i === 0 && firstSlideId ? firstSlideId : `slide_${i + 1}`;
    pageIds.push(pageId);
    if (i > 0 || !firstSlideId) {
      requests.push({
        createSlide: {
          objectId: pageId,
          slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
        },
      });
    }
  }

  // 4. タイトル / 本文を差し込むため、ページごとに shape を追加して insertText
  for (let i = 0; i < slides.length; i++) {
    const pageId = pageIds[i];
    const titleShape = `title_${i + 1}`;
    const bodyShape = `body_${i + 1}`;
    requests.push(
      {
        createShape: {
          objectId: titleShape,
          shapeType: "TEXT_BOX",
          elementProperties: {
            pageObjectId: pageId,
            size: {
              height: { magnitude: 60, unit: "PT" },
              width: { magnitude: 720, unit: "PT" },
            },
            transform: { scaleX: 1, scaleY: 1, translateX: 20, translateY: 20, unit: "PT" },
          },
        },
      },
      {
        insertText: { objectId: titleShape, text: slides[i].title },
      },
      {
        createShape: {
          objectId: bodyShape,
          shapeType: "TEXT_BOX",
          elementProperties: {
            pageObjectId: pageId,
            size: {
              height: { magnitude: 360, unit: "PT" },
              width: { magnitude: 720, unit: "PT" },
            },
            transform: { scaleX: 1, scaleY: 1, translateX: 20, translateY: 100, unit: "PT" },
          },
        },
      },
      {
        insertText: {
          objectId: bodyShape,
          text: slides[i].body || "（本文なし）",
        },
      },
    );
  }

  if (requests.length > 0) {
    await slidesApi.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });
  }

  return {
    presentationId,
    url: `https://docs.google.com/presentation/d/${presentationId}/edit`,
  };
}

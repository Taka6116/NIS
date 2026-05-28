import type { JWTInput } from "google-auth-library";

export type CredentialLoadResult =
  | { ok: true; creds: JWTInput }
  | { ok: false; reason: "missing_env" | "invalid_json"; message: string };

/**
 * 環境変数 GOOGLE_SERVICE_ACCOUNT_JSON を読み込む。
 * ローカル開発では GOOGLE_APPLICATION_CREDENTIALS（ファイルパス）も参照する。
 * 本番（Vercel）は必ず GOOGLE_SERVICE_ACCOUNT_JSON を使うこと。
 */
export function loadServiceAccountCredentials(): CredentialLoadResult {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return { ok: true, creds: JSON.parse(raw) as JWTInput };
    } catch {
      return {
        ok: false,
        reason: "invalid_json",
        message: "GOOGLE_SERVICE_ACCOUNT_JSON is set but could not be parsed as JSON. Check for line breaks or invalid characters.",
      };
    }
  }

  // ローカル開発: ファイルパスによる読み込み
  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath && process.env.NODE_ENV !== "production") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs") as { readFileSync: (p: string, enc: string) => string };
      const content = fs.readFileSync(filePath, "utf8");
      return { ok: true, creds: JSON.parse(content) as JWTInput };
    } catch {
      return {
        ok: false,
        reason: "invalid_json",
        message: `GOOGLE_APPLICATION_CREDENTIALS file at "${filePath}" could not be read or parsed.`,
      };
    }
  }

  return {
    ok: false,
    reason: "missing_env",
    message: "GOOGLE_SERVICE_ACCOUNT_JSON is not set. GA4 and GSC data cannot be fetched.",
  };
}

/** 後方互換 — null を返す旧 API。新コードは loadServiceAccountCredentials() を使うこと。 */
export function getServiceAccountCredentials(): JWTInput | null {
  const result = loadServiceAccountCredentials();
  return result.ok ? result.creds : null;
}

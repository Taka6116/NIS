import type { JWTInput } from "google-auth-library";

export function getServiceAccountCredentials(): JWTInput | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JWTInput;
  } catch {
    return null;
  }
}

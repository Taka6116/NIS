import Papa from "papaparse";
import type { AhrefsKeywordRow, AhrefsDatasetType } from "@/types/nis";

const HEADER_ALIASES: Record<string, string[]> = {
  keyword: ["keyword", "keywords"],
  volume: ["volume", "search volume", "sv"],
  kd: ["kd", "keyword difficulty", "difficulty"],
  cpc: ["cpc", "cost per click"],
  cps: ["cps", "clicks per search"],
  parentTopic: ["parent keyword", "parent topic", "parent_topic"],
  svTrend: ["sv trend"],
  svForecast: ["sv forecasting trend"],
  category: ["category"],
  trafficPotential: ["traffic potential"],
  globalVolume: ["global volume"],
  intents: ["intents"],
  serpFeatures: ["serp features"],
  position: ["current position", "position"],
  positionChange: ["position change"],
  url: ["current url", "url"],
  currentTraffic: ["current organic traffic"],
  previousTraffic: ["previous organic traffic"],
  trafficChange: ["organic traffic change", "traffic change"],
  branded: ["branded"],
};

function normalizeHeader(raw: string): string {
  return raw
    .replace(/[\uFEFF\uFFFE]/g, "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

function buildHeaderMap(rawHeaders: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < rawHeaders.length; i++) {
    const norm = normalizeHeader(rawHeaders[i]);
    for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(norm) && !(canonical in map)) {
        map[canonical] = i;
      }
    }
  }
  return map;
}

function parseTrendString(val: unknown): number[] {
  if (!val || typeof val !== "string") return [];
  const cleaned = val.replace(/^["']+|["']+$/g, "").trim();
  if (!cleaned) return [];
  return cleaned
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.\-]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "" || v === "—" || v === "-") return null;
  const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.\-]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function detectDatasetType(headerMap: Record<string, number>): AhrefsDatasetType {
  if ("position" in headerMap || "url" in headerMap || "currentTraffic" in headerMap) {
    return "organic";
  }
  return "keywords";
}

export function decodeCSVBuffer(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }
  const text = new TextDecoder("utf-8").decode(bytes);
  return text.replace(/^\uFEFF/, "");
}

export type ParsedCSVResult = {
  keywords: AhrefsKeywordRow[];
  type: AhrefsDatasetType;
};

export function parseAhrefsCSV(csvText: string): ParsedCSVResult {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  if (!result.data.length || result.data.length < 2) {
    throw new Error("CSV にデータ行がありません。");
  }

  const rawHeaders = result.data[0];
  const headerMap = buildHeaderMap(rawHeaders);

  if (!("keyword" in headerMap)) {
    throw new Error(
      `Keyword 列が見つかりません。検出ヘッダー: ${rawHeaders.map(normalizeHeader).join(", ")}`,
    );
  }

  const type = detectDatasetType(headerMap);
  const rows = result.data.slice(1);

  const keywords: AhrefsKeywordRow[] = rows
    .map((cols) => {
      const g = (key: string) => (key in headerMap ? cols[headerMap[key]] : undefined);
      const kw = (g("keyword") ?? "").toString().trim();
      if (!kw) return null;
      return {
        keyword: kw,
        volume: num(g("volume")),
        kd: num(g("kd")),
        cpc: num(g("cpc")),
        cps: num(g("cps")),
        parentTopic: (g("parentTopic") ?? "").toString(),
        svTrend: parseTrendString(g("svTrend")),
        category: (g("category") ?? "").toString(),
        trafficPotential: num(g("trafficPotential")),
        globalVolume: num(g("globalVolume")),
        intents: (g("intents") ?? "").toString(),
        position: numOrNull(g("position")),
        url: (g("url") ?? "").toString(),
        currentTraffic: numOrNull(g("currentTraffic")),
        trafficChange: numOrNull(g("trafficChange")),
        branded: (g("branded") ?? "").toString().toLowerCase() === "true",
        serpFeatures: (g("serpFeatures") ?? "").toString(),
      } satisfies AhrefsKeywordRow;
    })
    .filter((r): r is AhrefsKeywordRow => r !== null);

  return { keywords, type };
}

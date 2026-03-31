import type { NextConfig } from "next";
import * as path from "path";

const nextConfig: NextConfig = {
  /** アプリは常に web をルートとしてトレース（リポジトリ親を巻き込まない） */
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;

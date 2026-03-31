import type { NextConfig } from "next";
import * as path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;

import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(currentDirectory, "../.."),
  transpilePackages: ["@sakani/config", "@sakani/database", "@sakani/logger", "@sakani/shared"],
  poweredByHeader: false,
};

export default nextConfig;

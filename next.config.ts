import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project — the parent "Claude Works" folder
  // has an unrelated package-lock.json (a separate scaffold) that would
  // otherwise make Turbopack guess the wrong root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

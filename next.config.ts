import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sem standalone — `pnpm start` no Docker/EasyPanel (menos frágil que server.js)
};

export default nextConfig;

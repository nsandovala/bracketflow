import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // ...resto de tu config existente
};

export default nextConfig;

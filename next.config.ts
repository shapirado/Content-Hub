import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "200mb",
    },
    proxyClientMaxBodySize: "200mb",
  },
  serverExternalPackages: ["fluent-ffmpeg", "ffmpeg-static"],
};

export default nextConfig;

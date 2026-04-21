import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许服务端运行时使用 Node.js API
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;

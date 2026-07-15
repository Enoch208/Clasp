import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clasp/protocol", "@clasp/client"],
};

export default nextConfig;

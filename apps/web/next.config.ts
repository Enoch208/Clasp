import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clasp/protocol", "@clasp/client", "@clasp/token", "@clasp/react"],
};

export default nextConfig;

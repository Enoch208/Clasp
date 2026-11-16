import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clasp/protocol", "@useclasp/client", "@clasp/token", "@useclasp/react"],
  async redirects() {
    return [
      {
        source: "/video",
        destination: "https://youtu.be/HUzFXqXWo-A",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@clasp/protocol", "@clasp/client", "@clasp/token", "@clasp/react"],
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

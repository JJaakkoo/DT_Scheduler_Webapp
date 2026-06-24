import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/api/:path*",
            destination: "http://127.0.0.1:5328/api/:path*",
          },
        ]
      : [];
  },
};

export default nextConfig;
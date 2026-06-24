import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Only proxy to a local Flask server when developing
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
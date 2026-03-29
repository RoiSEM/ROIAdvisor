import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.0.191"],
  async redirects() {
    return [
      {
        source: "/clients",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/clients/:id",
        destination: "/dashboard/:id",
        permanent: false,
      },
      {
        source: "/clients/:id/edit",
        destination: "/dashboard/:id/edit",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

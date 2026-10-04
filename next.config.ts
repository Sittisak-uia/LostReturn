import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  allowedDevOrigins: [
    '192.168.1.114',
    '192.168.1.114:3000',
    'localhost:3000',
  ],
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

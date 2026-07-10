import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow document uploads (invoices/contracts) up to 15MB via Server Actions.
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;

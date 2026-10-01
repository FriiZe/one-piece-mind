import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les portraits sont déjà réduits et convertis en WebP à l'import (scripts/images/fetch.ts)
  images: { unoptimized: true },
};

export default nextConfig;

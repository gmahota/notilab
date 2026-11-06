import type { NextConfig } from "next";
import { LICENSED_IMAGE_REMOTE_PATTERNS } from "./lib/ingestion/image-rights";

const nextConfig: NextConfig = {
  /* config options here */

  images: {
    // Declared once, in lib/ingestion/image-rights.ts, so what next/image is
    // allowed to fetch cannot drift from what ingestion is allowed to store.
    // Only the open/licensed hosts are enumerable here — the same-origin and
    // outlet-CDN rules are decided per article, so those images still render
    // `unoptimized`.
    remotePatterns: LICENSED_IMAGE_REMOTE_PATTERNS,
  },
  async headers() {
    return [
      {
        source: '/admin(.*)',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rthfa4e7dp.ufs.sh",
        pathname: "/f",
      },
    ],
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

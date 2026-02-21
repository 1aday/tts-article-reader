import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/player/:audioId",
        destination: "/library?playAudioId=:audioId",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

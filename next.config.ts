import type { NextConfig } from "next";

// Lokale pilot: alleen op deze computer bereikbaar (zie README, "Veiligheid").
const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "mammoth"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;

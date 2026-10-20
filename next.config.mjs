import withPWA from "next-pwa";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  headers() {
    return [{
      source: "/",
      headers: [{
        key: "Permissions-Policy",
        // Prevent embedded players from publishing answers to system controls.
        // Unsupported browsers ignore this directive; parent metadata alone
        // cannot override a cross-origin player's independent media session.
        value: "mediasession=(self)",
      }],
    }];
  },
};

const withPwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cacheStartUrl: false,
});

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withAnalyzer(withPwaConfig(nextConfig));

import withPWA from "next-pwa";

const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
};

const withPwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

export default withPwaConfig(nextConfig);

import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Dockerfile.frontend 가 .next/standalone 을 복사해 `node server.js` 로 띄운다.
  // 이 옵션이 없으면 그 디렉터리가 아예 생성되지 않아 이미지 빌드가 COPY 에서 멈춘다.
  output: "standalone",
};

export default withPWA(nextConfig);
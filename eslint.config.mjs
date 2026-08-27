import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // next-pwa 생성물 (sw.js, workbox-*.js, swe-worker-*.js) — 빌드 산출물
    "public/**",
    // Vite 프로토타입, 프로덕션 코드 아님 (CLAUDE.md 참조)
    "references/**",
  ]),
  {
    // App Router 루트 레이아웃의 <head> <link>는 전 페이지에 적용됨.
    // 이 룰은 Pages Router의 pages/_document.js 전제라 여기선 false positive.
    // (Material Symbols는 아이콘 폰트라 next/font/google 데이터셋에 없어 마이그레이션 불가)
    files: ["src/app/layout.tsx"],
    rules: { "@next/next/no-page-custom-font": "off" },
  },
]);

export default eslintConfig;

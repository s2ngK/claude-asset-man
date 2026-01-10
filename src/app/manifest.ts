import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '우리 그룹 AI 가계부',
    short_name: 'AI 가계부',
    description: '영수증 스캔과 AI 분석을 지원하는 우리 그룹 가계부',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#13eca4',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/globe.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/window.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  }
}

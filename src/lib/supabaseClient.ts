import { createBrowserClient } from '@supabase/ssr';

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// 하위 호환성을 위해 기존 export 유지 (싱글톤 인스턴스 대신 함수 호출 권장)
export const supabase = createClient();
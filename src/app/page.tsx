import { createClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const supabase = await createClient();

  // 1. 세션 확인 (미들웨어에서도 하지만 한번 더 확인)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 2. 소속 그룹 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('group_id, groups(name, invite_code)')
    .eq('id', user.id)
    .single();

  if (!profile?.group_id) {
    redirect('/group');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          {profile.groups.name} 가계부
        </h1>
        <p className="text-xl text-slate-500 dark:text-slate-400">
          초대 코드: <code className="bg-slate-100 px-2 py-1 rounded font-mono font-bold text-primary">{profile.groups.invite_code}</code>
        </p>
      </div>

      <div className="flex gap-4">
        <Button asChild>
          <Link href="/transactions">내역 보기</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/stats">통계 확인</Link>
        </Button>
      </div>

      <div className="pt-8 opacity-50 text-sm">
        이곳에 대시보드와 최근 내역 리스트가 들어올 예정입니다.
      </div>
    </main>
  );
}
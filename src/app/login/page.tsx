'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearToken, login } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);
  const router = useRouter();

  // `useSearchParams` 를 쓰면 이 화면 전체가 Suspense 경계를 요구한다. 읽을 값이
  // 하나뿐이라 마운트 후 직접 본다.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reason') !== 'expired') return;
    setExpired(true);
    // proxy 가 쿠키는 지웠지만 localStorage 에는 죽은 토큰이 남아 있다.
    clearToken();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      await login(inviteCode.trim());
      router.push('/');
      router.refresh();
    } catch (err) {
      alert(getErrorMessage(err, '로그인에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">가계부 로그인</CardTitle>
          <CardDescription className="text-center">초대 코드를 입력하여 시작하세요.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {expired && (
              <p className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                세션이 만료되었습니다. 초대 코드를 다시 입력해 주세요.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">초대 코드</Label>
              <Input
                id="code"
                type="text"
                placeholder="초대 코드를 입력하세요"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '확인 중...' : '입장하기'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

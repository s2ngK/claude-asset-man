'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      await login(inviteCode.trim());
      router.push('/');
      router.refresh();
    } catch (err: any) {
      alert(err.message || '로그인에 실패했습니다.');
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

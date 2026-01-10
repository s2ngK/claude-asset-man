'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
      <div className="space-y-4">
        <span className="material-symbols-outlined text-6xl text-rose-500">warning</span>
        <h2 className="text-2xl font-bold">문제가 발생했습니다!</h2>
        <p className="text-slate-500 max-w-xs mx-auto">
          데이터를 처리하는 도중 예상치 못한 에러가 발생했습니다.
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <Button onClick={() => window.location.href = '/'}>홈으로</Button>
          <Button variant="outline" onClick={() => reset()}>다시 시도</Button>
        </div>
      </div>
    </div>
  );
}

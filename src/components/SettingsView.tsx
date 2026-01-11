'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';

interface SettingsViewProps {
  user: User;
  profile: any;
}

export default function SettingsView({ user, profile }: SettingsViewProps) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleUpdateProfile = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.id);

    if (error) {
      alert('프로필 수정 실패: ' + error.message);
    } else {
      alert('프로필이 업데이트되었습니다.');
    }
    setLoading(false);
  };

  const handleCopyCode = () => {
    if (profile?.groups?.invite_code) {
      navigator.clipboard.writeText(profile.groups.invite_code);
      alert('초대 코드가 복사되었습니다.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('정말 탈퇴하시겠습니까? 작성한 내역은 보존되지만 프로필은 삭제됩니다.')) return;
    
    // Auth User 삭제는 서비스 롤 키가 필요하거나, 
    // 사용자가 직접 탈퇴할 수 있도록 Edge Function을 써야 합니다.
    // 하지만 여기서는 프로필 데이터 삭제 후 로그아웃 처리로 '탈퇴'를 흉내냅니다.
    // (보안 정책상 profiles 테이블에 DELETE 권한을 줬으므로 가능)
    
    setLoading(true);
    const { error } = await supabase.from('profiles').delete().eq('id', user.id);
    
    if (error) {
        alert('탈퇴 처리 중 오류가 발생했습니다: ' + error.message);
        setLoading(false);
    } else {
        await supabase.auth.signOut();
        window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
        <Link href="/" className="text-slate-500">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h2 className="text-lg font-bold">설정</h2>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-8">
        {/* Profile Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">내 프로필</h3>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-4">
            <div className="size-20 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400">
               {/* Avatar Placeholder */}
               <span className="material-symbols-outlined text-4xl">person</span>
            </div>
            <div className="w-full space-y-2">
              <label className="text-xs font-bold ml-1">이름 (닉네임)</label>
              <div className="flex gap-2">
                <Input 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  className="bg-slate-50 dark:bg-slate-950"
                />
                <Button onClick={handleUpdateProfile} disabled={loading}>저장</Button>
              </div>
            </div>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
        </section>

        {/* Group Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">그룹 정보</h3>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
            <div>
                <p className="text-xs text-slate-400">그룹 이름</p>
                <p className="text-lg font-bold">{profile?.groups?.name || '소속 없음'}</p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-950 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <p className="text-xs text-slate-400 font-bold mb-1">초대 코드</p>
                    <p className="text-xl font-mono font-bold tracking-widest text-indigo-600 dark:text-indigo-400">
                        {profile?.groups?.invite_code || '-'}
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleCopyCode}>
                    <span className="material-symbols-outlined">content_copy</span>
                </Button>
            </div>
          </div>
        </section>

        {/* Account Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">계정 관리</h3>
          <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            <button 
                onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = '/login';
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
            >
                <span className="font-medium text-slate-700 dark:text-slate-300">로그아웃</span>
                <span className="material-symbols-outlined text-slate-400">logout</span>
            </button>
            <button 
                onClick={handleDeleteAccount}
                className="w-full flex items-center justify-between p-4 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors text-left group"
            >
                <span className="font-medium text-rose-500">회원 탈퇴</span>
                <span className="material-symbols-outlined text-rose-300 group-hover:text-rose-500">person_remove</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

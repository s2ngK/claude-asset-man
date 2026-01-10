
import React from 'react';
import { SAMPLE_MEMBERS } from '../constants';

const SettingsView: React.FC = () => {
  const handleAction = (label: string) => {
    alert(`${label} 기능은 다음 업데이트에서 제공될 예정입니다.`);
  };

  return (
    <div className="animate-in slide-in-from-right duration-300">
      <nav className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold absolute left-1/2 -translate-x-1/2">설정</h1>
        </div>
      </nav>

      <main className="max-w-md mx-auto pb-24">
        <div className="flex flex-col items-center pt-8 pb-6 px-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center overflow-hidden border-2 border-primary/20">
              <img alt="Household" className="w-full h-full object-cover" src="https://picsum.photos/seed/house/200" />
            </div>
            <button className="absolute bottom-0 right-0 bg-primary text-background-dark rounded-full p-1.5 border-4 border-background-light dark:border-background-dark">
              <span className="material-symbols-outlined text-sm font-bold">edit</span>
            </button>
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight">행복한 우리집</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">2024년 3월 생성 • 멤버 3명</p>
        </div>

        <section className="mx-4 mb-8">
          <div className="bg-white dark:bg-white/5 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
            <h3 className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 font-display">가족 초대 코드</h3>
            <div className="bg-slate-100 dark:bg-black/40 rounded-xl p-4 mb-4">
              <p className="text-2xl font-mono font-bold tracking-[0.2em] text-center text-slate-800 dark:text-white">A1B2-C3D4-E5F6</p>
            </div>
            <div className="flex flex-col gap-3">
              <button className="w-full h-12 bg-primary hover:bg-primary/90 text-background-dark font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                <span className="material-symbols-outlined">content_copy</span>
                <span>초대 코드 복사</span>
              </button>
              <button className="w-full h-12 bg-transparent border border-primary/30 text-primary font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
                <span className="material-symbols-outlined">refresh</span>
                <span>새 코드 생성</span>
              </button>
            </div>
          </div>
        </section>

        <section className="px-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold text-lg">그룹 멤버</h3>
            <span className="bg-primary/20 text-primary text-xs font-bold px-2.5 py-1 rounded-full">3 / 6 명</span>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5 shadow-sm">
            {SAMPLE_MEMBERS.map(member => (
              <div key={member.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <img src={member.avatar} className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10" alt={member.name} />
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{member.role === 'admin' ? '활동 중' : '최근 활동: 어제'}</p>
                  </div>
                </div>
                {member.role === 'admin' ? (
                  <span className="text-xs font-bold px-2 py-1 bg-primary text-background-dark rounded-lg uppercase tracking-tighter">관리자</span>
                ) : (
                  <button className="text-slate-400 p-1"><span className="material-symbols-outlined">more_horiz</span></button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Repositioned Features: Grouped together above the exit button */}
        <section className="px-4 mt-8 space-y-0 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5 shadow-sm">
          <button 
            onClick={() => handleAction('카테고리 편집')}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">category</span>
              </div>
              <span className="font-semibold text-sm">카테고리 편집</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-[20px]">chevron_right</span>
          </button>
          <button 
            onClick={() => handleAction('데이터 내보내기')}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">file_export</span>
              </div>
              <span className="font-semibold text-sm">데이터 내보내기 (Excel/CSV)</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-[20px]">chevron_right</span>
          </button>
        </section>

        <section className="px-4 mt-4">
          <button className="w-full flex items-center justify-between p-4 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 font-bold active:scale-[0.98] transition-all">
            <span>그룹 나가기</span>
            <span className="material-symbols-outlined">logout</span>
          </button>
        </section>
      </main>
    </div>
  );
};

export default SettingsView;

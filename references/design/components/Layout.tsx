
import React from 'react';
import { View } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: View;
  onViewChange: (view: View) => void;
  onOpenAddEntry: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, onOpenAddEntry }) => {
  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto relative bg-background-light dark:bg-background-dark">
      <main className="flex-1 pb-32">
        {children}
      </main>

      {/* Floating Action Button */}
      {activeView === View.HOME && (
        <button 
          onClick={onOpenAddEntry}
          className="fixed right-6 bottom-24 z-40 flex items-center justify-center rounded-full size-14 bg-primary text-slate-900 shadow-lg shadow-primary/30 active:scale-95 transition-transform hover:scale-105"
        >
          <span className="material-symbols-outlined text-[32px] font-bold">add</span>
        </button>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-50 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-6">
          <button 
            onClick={() => onViewChange(View.HOME)}
            className={`flex flex-col items-center gap-1 min-w-[3rem] transition-colors ${activeView === View.HOME ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}
          >
            <span className="material-symbols-outlined text-[24px]">home</span>
            <span className="text-[10px] font-bold">홈</span>
          </button>
          <button 
            onClick={() => onViewChange(View.STATS)}
            className={`flex flex-col items-center gap-1 min-w-[3rem] transition-colors ${activeView === View.STATS ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}
          >
            <span className="material-symbols-outlined text-[24px]">insights</span>
            <span className="text-[10px] font-medium">통계</span>
          </button>
          <button 
            onClick={() => onViewChange(View.SETTINGS)}
            className={`flex flex-col items-center gap-1 min-w-[3rem] transition-colors ${activeView === View.SETTINGS ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}
          >
            <span className="material-symbols-outlined text-[24px]">settings</span>
            <span className="text-[10px] font-medium">설정</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Layout;

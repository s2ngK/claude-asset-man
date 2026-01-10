
import React from 'react';

interface UndoToastProps {
  onUndo: () => void;
  onClose: () => void;
}

const UndoToast: React.FC<UndoToastProps> = ({ onUndo, onClose }) => {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-2.5rem)] max-w-sm animate-in fade-in slide-in-from-bottom-6 duration-500">
      <div className="bg-slate-900/95 dark:bg-white/95 backdrop-blur-md text-white dark:text-slate-900 rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-white/10 dark:border-black/5">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-rose-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-rose-500 text-[18px]">delete_sweep</span>
          </div>
          <p className="text-[13px] font-semibold">내역이 삭제되었습니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onUndo}
            className="text-primary font-bold text-[13px] px-3 py-1.5 rounded-lg hover:bg-primary/10 active:scale-95 transition-all"
          >
            되돌리기
          </button>
          <button onClick={onClose} className="p-1 opacity-40 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UndoToast;


import React, { useState, useCallback, useEffect } from 'react';
import Layout from './components/Layout';
import HomeView from './components/HomeView';
import StatsView from './components/StatsView';
import SettingsView from './components/SettingsView';
import AddEntryModal from './components/AddEntryModal';
import SearchModal from './components/SearchModal';
import UndoToast from './components/UndoToast';
import { View, Transaction } from './types';
import { SAMPLE_TRANSACTIONS } from './constants';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>(View.HOME);
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(SAMPLE_TRANSACTIONS);
  const [lastDeleted, setLastDeleted] = useState<{ transaction: Transaction, index: number } | null>(null);
  const [showUndo, setShowUndo] = useState(false);

  const handleSaveEntry = (amount: number, categoryId: string, memo: string, type: 'expense' | 'income') => {
    if (editingTransaction) {
      // Update logic
      setTransactions(prev => prev.map(t => 
        t.id === editingTransaction.id 
          ? { ...t, amount, category: categoryId, title: memo || '새로운 내역', memo: '수정됨', type } 
          : t
      ));
      setEditingTransaction(null);
    } else {
      // Create logic
      const newEntry: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().split('T')[0],
        title: memo || '새로운 내역',
        category: categoryId,
        amount: amount,
        type: type,
        memo: '사용자 추가'
      };
      setTransactions(prev => [newEntry, ...prev]);
    }
  };

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => {
      const index = prev.findIndex(t => t.id === id);
      if (index !== -1) {
        const transaction = prev[index];
        setLastDeleted({ transaction, index });
        setShowUndo(true);
        return prev.filter(t => t.id !== id);
      }
      return prev;
    });
  }, []);

  const handleEditTransaction = useCallback((id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      setEditingTransaction(tx);
      setIsAddEntryOpen(true);
    }
  }, [transactions]);

  const handleCloseAddEntry = () => {
    setIsAddEntryOpen(false);
    setEditingTransaction(null);
  };

  const undoDelete = useCallback(() => {
    if (lastDeleted) {
      setTransactions(prev => {
        const newList = [...prev];
        newList.splice(lastDeleted.index, 0, lastDeleted.transaction);
        return newList;
      });
      setLastDeleted(null);
      setShowUndo(false);
    }
  }, [lastDeleted]);

  useEffect(() => {
    if (showUndo) {
      const timer = setTimeout(() => setShowUndo(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showUndo]);

  return (
    <Layout 
      activeView={activeView} 
      onViewChange={setActiveView}
      onOpenAddEntry={() => setIsAddEntryOpen(true)}
    >
      {activeView === View.HOME && (
        <HomeView 
          transactions={transactions} 
          onDeleteTransaction={deleteTransaction} 
          onOpenSearch={() => setIsSearchOpen(true)}
          onEditTransaction={handleEditTransaction}
        />
      )}
      {activeView === View.STATS && <StatsView transactions={transactions} />}
      {activeView === View.SETTINGS && <SettingsView />}
      
      {isAddEntryOpen && (
        <AddEntryModal 
          onClose={handleCloseAddEntry} 
          onSave={handleSaveEntry}
          initialData={editingTransaction || undefined}
          isEdit={!!editingTransaction}
        />
      )}

      {isSearchOpen && (
        <SearchModal 
          transactions={transactions} 
          onClose={() => setIsSearchOpen(false)} 
          onDeleteTransaction={deleteTransaction}
        />
      )}

      {showUndo && (
        <UndoToast onUndo={undoDelete} onClose={() => setShowUndo(false)} />
      )}
    </Layout>
  );
};

export default App;

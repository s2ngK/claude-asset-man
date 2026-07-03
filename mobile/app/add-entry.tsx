import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, Alert, Modal, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronDown, X, Delete, CheckCircle2 } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { getCategories, createTransaction, updateTransaction, type Category } from '../src/lib/api';

type TransactionType = 'income' | 'expense';

export default function AddEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEdit = !!params.id;

  const [type, setType] = useState<TransactionType>((params.type as TransactionType) || 'expense');
  const [amountStr, setAmountStr] = useState((params.amount as string) || '0');
  const [description, setDescription] = useState((params.description as string) || '');
  const [categoryId, setCategoryId] = useState((params.category_id as string) || '');
  const [categoryName, setCategoryName] = useState((params.category as string) || '식비');
  const [date, setDate] = useState(params.date ? parseISO(params.date as string) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    getCategories().then(cats => {
      setCategories(cats);
      // 초기 category_id 설정
      if (!categoryId) {
        const first = cats.find(c => c.type === type);
        if (first) { setCategoryId(first.id); setCategoryName(first.name); }
      }
    }).catch(console.error);
  }, []);

  const filteredCategories = categories.filter(c => c.type === type);

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const first = categories.find(c => c.type === newType);
    if (first) { setCategoryId(first.id); setCategoryName(first.name); }
  };

  const handleKeyPress = (key: string) => {
    if (key === 'back') { setAmountStr(prev => prev.length > 1 ? prev.slice(0, -1) : '0'); return; }
    if (key === 'C') { setAmountStr('0'); return; }
    setAmountStr(prev => {
      if (prev === '0') return key === '00' ? '0' : key;
      if (prev.length > 12) return prev;
      return prev + key;
    });
  };

  const handleSave = async () => {
    const amount = parseInt(amountStr);
    if (amount <= 0) { Alert.alert('경고', '금액을 입력해주세요.'); return; }
    if (!description.trim()) { Alert.alert('경고', '내용을 입력해주세요.'); return; }
    if (!categoryId) { Alert.alert('경고', '카테고리를 선택해주세요.'); return; }

    setLoading(true);
    try {
      const txData = { category_id: categoryId, type, amount, description, date: format(date, 'yyyy-MM-dd') };
      if (isEdit) {
        await updateTransaction(params.id as string, txData);
      } else {
        await createTransaction(txData);
      }
      router.back();
    } catch (err: any) {
      Alert.alert('오류', '저장 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}><X size={24} color="#64748b" /></Pressable>
        <Text style={styles.headerTitle}>{isEdit ? '내역 수정' : '내역 추가'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.typeToggle}>
          <Pressable onPress={() => handleTypeChange('expense')} style={[styles.typeBtn, type === 'expense' && styles.activeExpense]}>
            <Text style={[styles.typeText, type === 'expense' && styles.activeExpenseText]}>지출</Text>
          </Pressable>
          <Pressable onPress={() => handleTypeChange('income')} style={[styles.typeBtn, type === 'income' && styles.activeIncome]}>
            <Text style={[styles.typeText, type === 'income' && styles.activeIncomeText]}>수입</Text>
          </Pressable>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>{type === 'expense' ? '지출 금액' : '수입 금액'}</Text>
          <Text style={styles.amountValue}>
            {new Intl.NumberFormat('ko-KR').format(parseInt(amountStr))}
            <Text style={styles.amountUnit}> 원</Text>
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>내용</Text>
          <TextInput style={styles.textInput} value={description} onChangeText={setDescription}
            placeholder={type === 'expense' ? '어디서 지출하셨나요?' : '어디서 수입이 발생했나요?'} />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>날짜</Text>
            <Pressable style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.pickerText}>{format(date, 'yyyy-MM-dd')}</Text>
            </Pressable>
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>카테고리</Text>
            <Pressable style={styles.pickerBtn} onPress={() => setShowCategoryPicker(true)}>
              <Text style={styles.pickerText}>{categoryName}</Text>
              <ChevronDown size={16} color="#94a3b8" />
            </Pressable>
          </View>
        </View>

        {showDatePicker && (Platform.OS === 'ios' || Platform.OS === 'android') && (
          <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }} />
        )}
      </ScrollView>

      <View style={styles.keypadContainer}>
        {[['7','8','9','C'],['4','5','6','back'],['1','2','3',isEdit?'수정':'완료'],['0','00','','']]
          .map((row, ri) => (
            <View key={ri} style={styles.keypadRow}>
              {row.map((key, ki) => key === '' ? <View key={ki} style={{ flex: 1 }} /> : (
                <KeyButton key={ki} label={key} onPress={handleSave} handleKeyPress={handleKeyPress}
                  variant={key === 'C' || key === 'back' ? 'action' : key === '완료' || key === '수정' ? 'primary' : 'default'}
                  icon={key === 'back' ? <Delete size={20} color="#6366f1" /> : key === '완료' || key === '수정' ? <CheckCircle2 size={24} color="white" /> : undefined} />
              ))}
            </View>
          ))}
      </View>

      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.categoryPicker}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>카테고리 선택</Text>
              <Pressable onPress={() => setShowCategoryPicker(false)}><X size={24} color="#64748b" /></Pressable>
            </View>
            <ScrollView>
              {filteredCategories.map(cat => (
                <Pressable key={cat.id} style={styles.categoryOption}
                  onPress={() => { setCategoryId(cat.id); setCategoryName(cat.name); setShowCategoryPicker(false); }}>
                  <Text style={styles.categoryOptionText}>{cat.icon} {cat.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function KeyButton({ label, onPress, handleKeyPress, variant = 'default', icon }: any) {
  const bgColor = variant === 'primary' ? '#6366f1' : variant === 'action' ? '#e0e7ff' : '#fff';
  const isDone = label === '완료' || label === '수정';
  return (
    <Pressable onPress={() => isDone ? onPress() : handleKeyPress(label)}
      style={[styles.keyBtn, { backgroundColor: bgColor }, isDone && { flex: 1, flexDirection: 'row', gap: 8 }]}>
      {icon ? icon : <Text style={[styles.keyText, variant === 'primary' && { color: '#fff' }]}>{label}</Text>}
      {isDone && <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 10, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  closeBtn: { padding: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 20 },
  typeToggle: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  typeBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', borderRadius: 16, borderWidth: 2, borderColor: '#f1f5f9' },
  activeExpense: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  activeExpenseText: { color: '#ef4444' },
  activeIncome: { borderColor: '#e0e7ff', backgroundColor: '#eef2ff' },
  activeIncomeText: { color: '#6366f1' },
  typeText: { fontSize: 16, fontWeight: 'bold', color: '#94a3b8' },
  amountBox: { backgroundColor: '#f8fafc', borderRadius: 20, padding: 20, alignItems: 'flex-end', marginBottom: 20 },
  amountLabel: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold', marginBottom: 4 },
  amountValue: { fontSize: 36, fontWeight: 'bold', color: '#6366f1' },
  amountUnit: { fontSize: 20, color: '#94a3b8' },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8', marginBottom: 8, marginLeft: 4 },
  textInput: { backgroundColor: '#f8fafc', borderRadius: 16, height: 56, paddingHorizontal: 16, fontSize: 16, color: '#1e293b' },
  row: { flexDirection: 'row', gap: 12 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 16, height: 56, paddingHorizontal: 16 },
  pickerText: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  keypadContainer: { backgroundColor: '#f8fafc', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  keypadRow: { flexDirection: 'row', gap: 8 },
  keyBtn: { flex: 1, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 1 },
  keyText: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  categoryPicker: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  categoryOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  categoryOptionText: { fontSize: 16, color: '#1e293b' },
});

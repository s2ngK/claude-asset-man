import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabaseClient';
import { scanReceipt } from '../src/services/gemini';
import { Camera, ChevronDown, X, Backspace, CheckCircle2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { TransactionType } from '../src/types';

const DEFAULT_CATEGORIES = [
  { id: '1', name: '식비', icon: '🍔' },
  { id: '2', name: '교통', icon: '🚌' },
  { id: '3', name: '쇼핑', icon: '🛍️' },
  { id: '4', name: '주거/통신', icon: '🏠' },
  { id: '5', name: '의료/건강', icon: '🏥' },
  { id: '6', name: '기타', icon: '💰' },
];

export default function AddEntryScreen() {
  const router = useRouter();
  const [entryMode, setEntryMode] = useState<'direct' | 'ai'>('direct');
  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('0');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('식비');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const handleKeyPress = (key: string) => {
    if (key === 'back') {
      setAmountStr(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
      return;
    }
    if (key === 'C') {
      setAmountStr('0');
      return;
    }
    setAmountStr(prev => {
      if (prev === '0') return key === '00' ? '0' : key;
      if (prev.length > 12) return prev;
      return prev + key;
    });
  };

  const handleScanReceipt = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setLoading(true);
      try {
        const ocrResult = await scanReceipt(result.assets[0].base64, 'image/jpeg');
        if (ocrResult) {
          setAmountStr(ocrResult.amount.toString());
          setCategory(ocrResult.category);
          setDescription(ocrResult.description);
          if (ocrResult.date) setDate(new Date(ocrResult.date));
          Alert.alert('성공', '영수증 분석이 완료되었습니다!');
        }
      } catch (error) {
        Alert.alert('오류', '영수증 분석 중 문제가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSave = async () => {
    const amount = parseInt(amountStr);
    if (amount <= 0) {
      Alert.alert('경고', '금액을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const { data: profile } = await supabase.from('profiles').select('group_id').eq('id', user.id).single();
      if (!profile?.group_id) throw new Error('No group');

      // Simple category lookup (should be improved to match DB IDs)
      const { data: catData } = await supabase
        .from('categories')
        .select('id')
        .eq('name', category)
        .limit(1)
        .single();

      if (!catData) throw new Error('Category not found');

      const { error } = await supabase.from('transactions').insert([{
        group_id: profile.group_id,
        user_id: user.id,
        category_id: catData.id,
        type,
        amount,
        description,
        date: format(date, 'yyyy-MM-dd'),
      }]);

      if (error) throw error;
      router.back();
    } catch (error: any) {
      Alert.alert('오류', '저장 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color="#64748b" />
        </Pressable>
        <Text style={styles.headerTitle}>내역 추가</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <Pressable 
            onPress={() => setEntryMode('direct')}
            style={[styles.modeButton, entryMode === 'direct' && styles.activeMode]}
          >
            <Text style={[styles.modeText, entryMode === 'direct' && styles.activeModeText]}>직접 입력</Text>
          </Pressable>
          <Pressable 
            onPress={() => setEntryMode('ai')}
            style={[styles.modeButton, entryMode === 'ai' && styles.activeMode]}
          >
            <Text style={[styles.modeText, entryMode === 'ai' && styles.activeModeText]}>AI 영수증 스캔</Text>
          </Pressable>
        </View>

        {entryMode === 'ai' && (
          <Pressable style={styles.aiBox} onPress={handleScanReceipt} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#6366f1" />
            ) : (
              <>
                <Camera size={40} color="#6366f1" />
                <Text style={styles.aiTitle}>영수증 사진을 찍어주세요</Text>
                <Text style={styles.aiDesc}>AI가 자동으로 입력해드립니다.</Text>
              </>
            )}
          </Pressable>
        )}

        {/* Type Toggle */}
        <View style={styles.typeToggle}>
          <Pressable 
            onPress={() => setType('expense')}
            style={[styles.typeButton, type === 'expense' && styles.activeExpense]}
          >
            <Text style={[styles.typeText, type === 'expense' && styles.activeExpenseText]}>지출</Text>
          </Pressable>
          <Pressable 
            onPress={() => setType('income')}
            style={[styles.typeButton, type === 'income' && styles.activeIncome]}
          >
            <Text style={[styles.typeText, type === 'income' && styles.activeIncomeText]}>수입</Text>
          </Pressable>
        </View>

        {/* Amount */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>{type === 'expense' ? '지출 금액' : '수입 금액'}</Text>
          <Text style={styles.amountValue}>
            {new Intl.NumberFormat('ko-KR').format(parseInt(amountStr))}
            <Text style={styles.amountUnit}> 원</Text>
          </Text>
        </View>

        {/* Form Fields */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>내용</Text>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder={type === 'expense' ? "어디서 지출하셨나요?" : "어디서 수입이 발생했나요?"}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>날짜</Text>
            <Pressable style={styles.pickerButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.pickerText}>{format(date, 'yyyy-MM-dd')}</Text>
            </Pressable>
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>카테고리</Text>
            <Pressable style={styles.pickerButton} onPress={() => setShowCategoryPicker(true)}>
              <Text style={styles.pickerText}>{category}</Text>
              <ChevronDown size={16} color="#94a3b8" />
            </Pressable>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setDate(selectedDate);
            }}
          />
        )}
      </ScrollView>

      {/* Keypad */}
      <View style={styles.keypadContainer}>
        <View style={styles.keypadRow}>
          <KeyButton label="7" onPress={handleKeyPress} />
          <KeyButton label="8" onPress={handleKeyPress} />
          <KeyButton label="9" onPress={handleKeyPress} />
          <KeyButton label="C" onPress={handleKeyPress} variant="action" />
        </View>
        <View style={styles.keypadRow}>
          <KeyButton label="4" onPress={handleKeyPress} />
          <KeyButton label="5" onPress={handleKeyPress} />
          <KeyButton label="6" onPress={handleKeyPress} />
          <KeyButton label="back" onPress={handleKeyPress} variant="action" icon={<Backspace size={20} color="#6366f1" />} />
        </View>
        <View style={styles.keypadRow}>
          <KeyButton label="1" onPress={handleKeyPress} />
          <KeyButton label="2" onPress={handleKeyPress} />
          <KeyButton label="3" onPress={handleKeyPress} />
          <KeyButton label="완료" onPress={handleSave} variant="primary" icon={<CheckCircle2 size={24} color="white" />} />
        </View>
        <View style={styles.keypadRow}>
          <KeyButton label="0" onPress={handleKeyPress} />
          <KeyButton label="00" onPress={handleKeyPress} />
          <View style={{ flex: 2 }} />
        </View>
      </View>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.categoryPicker}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>카테고리 선택</Text>
              <Pressable onPress={() => setShowCategoryPicker(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
            </View>
            <ScrollView>
              {DEFAULT_CATEGORIES.map((cat) => (
                <Pressable 
                  key={cat.id} 
                  style={styles.categoryOption}
                  onPress={() => {
                    setCategory(cat.name);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.categoryOptionText}>{cat.icon} {cat.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function KeyButton({ label, onPress, variant = 'default', icon }: any) {
  let bgColor = '#fff';
  let textColor = '#1e293b';

  if (variant === 'action') bgColor = '#e0e7ff';
  if (variant === 'primary') bgColor = '#6366f1';

  return (
    <Pressable 
      onPress={() => onPress(label === '완료' ? '' : label)}
      style={[styles.keyButton, { backgroundColor: bgColor }, label === '완료' && { flex: 1, flexDirection: 'row', gap: 8 }]}
    >
      {icon ? icon : <Text style={[styles.keyText, variant === 'primary' && { color: '#fff' }]}>{label}</Text>}
      {label === '완료' && <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>완료</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  closeButton: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 20,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 4,
    borderRadius: 16,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeMode: {
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  activeModeText: {
    color: '#6366f1',
  },
  aiBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginBottom: 20,
  },
  aiTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 12,
  },
  aiDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  typeToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#f1f5f9',
  },
  activeExpense: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  activeExpenseText: {
    color: '#ef4444',
  },
  activeIncome: {
    borderColor: '#e0e7ff',
    backgroundColor: '#eef2ff',
  },
  activeIncomeText: {
    color: '#6366f1',
  },
  typeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  amountBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 20,
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  amountUnit: {
    fontSize: 20,
    color: '#94a3b8',
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 8,
    marginLeft: 4,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1e293b',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 16,
  },
  pickerText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  keypadContainer: {
    backgroundColor: '#f8fafc',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keyButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  keyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  categoryPicker: {
    backgroundColor: 'white',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  categoryOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#1e293b',
  }
});

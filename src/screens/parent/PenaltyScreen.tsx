import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { PenaltyCategory, minutesToTimeString } from '../../types';
import { PENALTY_ACTIVITIES } from '../../constants/activities';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/theme';

function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? title + '\n' + message : title);
  } else {
    Alert.alert(title, message);
  }
}

function showConfirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(title + '\n' + message)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      { text: '부과하기', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

export default function PenaltyScreen() {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [selectedPenalty, setSelectedPenalty] = useState<PenaltyCategory | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.linkedFamilyCode) return;
    const usersRef = collection(db, 'users');
    const studentQuery = query(usersRef, where('familyCode', '==', user.linkedFamilyCode));
    const unsubStudent = onSnapshot(studentQuery, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setStudentId(doc.id);
        setStudentName(doc.data().name);
      }
    });
    return () => unsubStudent();
  }, [user?.linkedFamilyCode]);

  function getSelectedPenaltyInfo() {
    return PENALTY_ACTIVITIES.find(p => p.category === selectedPenalty);
  }

  async function handleAddPenalty() {
    if (!studentId || !selectedPenalty) return;
    const penaltyInfo = getSelectedPenaltyInfo();
    if (!penaltyInfo) return;

    showConfirm(
      '벌금 부과',
      studentName + '에게 ' + penaltyInfo.label + ' 벌금(' + minutesToTimeString(penaltyInfo.fixedMinutes || 0) + ')을 부과할까요?',
      async () => {
        setLoading(true);
        try {
          const penaltyMinutes = penaltyInfo.fixedMinutes || 0;
          await addDoc(collection(db, 'activities'), {
            userId: studentId,
            familyCode: user?.linkedFamilyCode,
            date: new Date(),
            type: 'penalty',
            category: selectedPenalty,
            durationMinutes: penaltyMinutes,
            multiplier: 1,
            earnedMinutes: penaltyMinutes,
            needsApproval: false,
            status: 'approved',
            description: description || null,
            createdBy: user?.id,
            createdAt: new Date(),
          });
          const balanceRef = doc(db, 'balances', studentId);
          const balanceDoc = await getDoc(balanceRef);
          const currentBalance = balanceDoc.exists() ? balanceDoc.data().currentBalance : 0;
          await updateDoc(balanceRef, {
            currentBalance: currentBalance - penaltyMinutes,
            lastUpdated: new Date(),
          });
          showAlert('벌금 부과 완료', minutesToTimeString(penaltyMinutes) + '이 차감되었습니다');
          setSelectedPenalty(null);
          setDescription('');
        } catch (err) {
          console.error('Penalty error:', err);
          showAlert('오류', '벌금 부과 중 오류가 발생했습니다');
        } finally {
          setLoading(false);
        }
      }
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⚠️ 벌금 부과</Text>
          <Text style={styles.headerSubtitle}>
            규칙을 어겼을 때 벌금을 부과해요
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>벌금 종류 선택</Text>
          {PENALTY_ACTIVITIES.map((penalty) => {
            const isSelected = selectedPenalty === penalty.category;
            return (
              <TouchableOpacity
                key={penalty.category}
                style={[styles.penaltyCard, isSelected && styles.penaltyCardSelected]}
                onPress={() => setSelectedPenalty(penalty.category as PenaltyCategory)}
              >
                <Text style={styles.penaltyEmoji}>{penalty.emoji}</Text>
                <View style={styles.penaltyInfo}>
                  <Text style={[styles.penaltyLabel, isSelected && styles.penaltyLabelSelected]}>
                    {penalty.label}
                  </Text>
                  <Text style={styles.penaltyDesc}>
                    {penalty.category === 'no_record' && '하루 기록을 하지 않았을 때'}
                    {penalty.category === 'no_balance' && '잔액 없이 게임/유튜브를 했을 때'}
                    {penalty.category === 'lying' && '거짓말을 했을 때'}
                  </Text>
                </View>
                <View style={[styles.penaltyAmount, isSelected && styles.penaltyAmountSelected]}>
                  <Text style={[styles.penaltyAmountText, isSelected && styles.penaltyAmountTextSelected]}>
                    -{minutesToTimeString(penalty.fixedMinutes || 0)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedPenalty && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>사유 입력 (선택)</Text>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="예: 어제 기록 안함"
              placeholderTextColor={COLORS.textLight}
              multiline
            />
          </View>
        )}

        {selectedPenalty && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>미리보기</Text>
            <View style={styles.previewContent}>
              <Text style={styles.previewEmoji}>{getSelectedPenaltyInfo()?.emoji}</Text>
              <View style={styles.previewInfo}>
                <Text style={styles.previewLabel}>{getSelectedPenaltyInfo()?.label}</Text>
                <Text style={styles.previewStudent}>{studentName}에게 부과</Text>
              </View>
              <Text style={styles.previewAmount}>
                -{minutesToTimeString(getSelectedPenaltyInfo()?.fixedMinutes || 0)}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedPenalty || loading) && styles.submitButtonDisabled,
          ]}
          onPress={handleAddPenalty}
          disabled={!selectedPenalty || loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.textWhite} />
          ) : (
            <Text style={styles.submitButtonText}>벌금 부과하기</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.lg },
  headerTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.textPrimary },
  headerSubtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginTop: SPACING.xs },
  section: { backgroundColor: COLORS.card, marginHorizontal: SPACING.md, marginBottom: SPACING.md, padding: SPACING.lg, borderRadius: BORDER_RADIUS.xl, ...SHADOWS.medium },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: SPACING.md },
  penaltyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardAlt, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 2, borderColor: 'transparent' },
  penaltyCardSelected: { borderColor: COLORS.penalty, backgroundColor: COLORS.penalty + '10' },
  penaltyEmoji: { fontSize: 32, marginRight: SPACING.md },
  penaltyInfo: { flex: 1 },
  penaltyLabel: { fontSize: FONT_SIZES.md, fontWeight: 'bold', color: COLORS.textPrimary },
  penaltyLabelSelected: { color: COLORS.penalty },
  penaltyDesc: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  penaltyAmount: { backgroundColor: COLORS.card, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full },
  penaltyAmountSelected: { backgroundColor: COLORS.penalty },
  penaltyAmountText: { fontSize: FONT_SIZES.md, fontWeight: 'bold', color: COLORS.penalty },
  penaltyAmountTextSelected: { color: COLORS.textWhite },
  descriptionInput: { backgroundColor: COLORS.cardAlt, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textPrimary, minHeight: 80, textAlignVertical: 'top' },
  previewCard: { backgroundColor: COLORS.penalty + '15', marginHorizontal: SPACING.md, marginBottom: SPACING.md, padding: SPACING.lg, borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: COLORS.penalty },
  previewTitle: { fontSize: FONT_SIZES.sm, color: COLORS.penalty, marginBottom: SPACING.md, fontWeight: '600' },
  previewContent: { flexDirection: 'row', alignItems: 'center' },
  previewEmoji: { fontSize: 40, marginRight: SPACING.md },
  previewInfo: { flex: 1 },
  previewLabel: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.textPrimary },
  previewStudent: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  previewAmount: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.penalty },
  submitButton: { backgroundColor: COLORS.penalty, marginHorizontal: SPACING.md, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', ...SHADOWS.medium },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: COLORS.textWhite, fontSize: FONT_SIZES.lg, fontWeight: 'bold' },
});

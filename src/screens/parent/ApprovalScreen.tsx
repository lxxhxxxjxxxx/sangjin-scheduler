import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
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
  updateDoc,
  getDoc,
  addDoc,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Activity, minutesToTimeString, PenaltyCategory } from '../../types';
import { getActivityConfig, PENALTY_ACTIVITIES } from '../../constants/activities';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/theme';

function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? title + '\n' + message : title);
  } else {
    Alert.alert(title, message);
  }
}

export default function ApprovalScreen() {
  const { user } = useAuth();
  const [pendingActivities, setPendingActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingActivity, setRejectingActivity] = useState<Activity | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);

  // 벌금 관련 상태
  const [selectedPenalty, setSelectedPenalty] = useState<PenaltyCategory | null>(null);
  const [penaltyDescription, setPenaltyDescription] = useState('');
  const [penaltyProcessing, setPenaltyProcessing] = useState(false);

  useEffect(() => {
    if (!user?.linkedFamilyCode) return;
    const usersRef = collection(db, 'users');
    const studentQuery = query(usersRef, where('familyCode', '==', user.linkedFamilyCode));
    const unsubStudent = onSnapshot(studentQuery, (snapshot) => {
      if (!snapshot.empty) {
        setStudentId(snapshot.docs[0].id);
      }
    });
    return () => unsubStudent();
  }, [user?.linkedFamilyCode]);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    const activitiesRef = collection(db, 'activities');
    const q = query(
      activitiesRef,
      where('userId', '==', studentId),
      where('needsApproval', '==', true),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activities: Activity[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          familyCode: data.familyCode,
          date: data.date?.toDate() || new Date(),
          type: data.type,
          category: data.category,
          durationMinutes: data.durationMinutes,
          multiplier: data.multiplier,
          earnedMinutes: data.earnedMinutes,
          needsApproval: data.needsApproval,
          status: data.status,
          description: data.description,
          startTime: data.startTime,
          endTime: data.endTime,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
      setPendingActivities(activities);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [studentId]);

  async function handleApprove(activity: Activity) {
    if (!studentId) return;
    setProcessingId(activity.id);
    try {
      await updateDoc(doc(db, 'activities', activity.id), {
        status: 'approved',
        approvedBy: user?.id,
        approvedAt: new Date(),
      });
      const balanceRef = doc(db, 'balances', studentId);
      const balanceDoc = await getDoc(balanceRef);
      const currentBalance = balanceDoc.exists() ? balanceDoc.data().currentBalance : 0;
      await updateDoc(balanceRef, {
        currentBalance: currentBalance + activity.earnedMinutes,
        lastUpdated: new Date(),
      });
      showAlert('승인 완료!', minutesToTimeString(activity.earnedMinutes) + '이 추가되었어요');
    } catch (err) {
      console.error('Approve error:', err);
      showAlert('오류', '승인 처리 중 오류가 발생했습니다');
    } finally {
      setProcessingId(null);
    }
  }

  function openRejectModal(activity: Activity) {
    setRejectingActivity(activity);
    setRejectReason('');
    setShowRejectModal(true);
  }

  async function handleReject() {
    if (!rejectingActivity) return;
    setProcessingId(rejectingActivity.id);
    try {
      await updateDoc(doc(db, 'activities', rejectingActivity.id), {
        status: 'rejected',
        approvedBy: user?.id,
        approvedAt: new Date(),
        rejectReason: rejectReason || null,
      });
      setShowRejectModal(false);
      setRejectingActivity(null);
      showAlert('거절 완료', '활동이 거절되었습니다');
    } catch (err) {
      console.error('Reject error:', err);
      showAlert('오류', '거절 처리 중 오류가 발생했습니다');
    } finally {
      setProcessingId(null);
    }
  }

  function formatDate(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return month + '/' + day + ' (' + weekday + ')';
  }

  async function handleAddPenalty() {
    if (!selectedPenalty || !studentId || !user?.linkedFamilyCode) return;
    const penaltyConfig = PENALTY_ACTIVITIES.find((p) => p.category === selectedPenalty);
    if (!penaltyConfig || !penaltyConfig.fixedMinutes) return;

    const penaltyMinutes = penaltyConfig.fixedMinutes;

    setPenaltyProcessing(true);
    try {
      const now = new Date();
      await addDoc(collection(db, 'activities'), {
        userId: studentId,
        familyCode: user.linkedFamilyCode,
        date: now,
        type: 'penalty',
        category: selectedPenalty,
        durationMinutes: penaltyMinutes,
        multiplier: 1,
        earnedMinutes: -penaltyMinutes,
        needsApproval: false,
        status: 'approved',
        approvedBy: user.id,
        approvedAt: now,
        description: penaltyDescription || null,
        createdAt: now,
      });

      const balanceRef = doc(db, 'balances', studentId);
      const balanceDoc = await getDoc(balanceRef);
      const currentBalance = balanceDoc.exists() ? balanceDoc.data().currentBalance : 0;
      await updateDoc(balanceRef, {
        currentBalance: currentBalance - penaltyMinutes,
        lastUpdated: now,
      });

      showAlert('벌금 부과 완료!', minutesToTimeString(penaltyMinutes) + '이 차감되었어요');
      setSelectedPenalty(null);
      setPenaltyDescription('');
    } catch (err) {
      console.error('Penalty error:', err);
      showAlert('오류', '벌금 부과 중 오류가 발생했습니다');
    } finally {
      setPenaltyProcessing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⏳ 승인 대기</Text>
          <Text style={styles.headerSubtitle}>
            {pendingActivities.length}개의 활동이 확인을 기다리고 있어요
          </Text>
        </View>

        {pendingActivities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>모두 처리했어요!</Text>
            <Text style={styles.emptyDesc}>승인 대기 중인 활동이 없습니다</Text>
          </View>
        ) : (
          pendingActivities.map((activity) => {
            const config = getActivityConfig(activity.category);
            const isProcessing = processingId === activity.id;
            return (
              <View key={activity.id} style={styles.activityCard}>
                <View style={styles.activityHeader}>
                  <View style={styles.activityEmoji}>
                    <Text style={styles.activityEmojiText}>{config?.emoji || '📝'}</Text>
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityLabel}>{config?.label || activity.category}</Text>
                    <Text style={styles.activityDate}>{formatDate(activity.date)}</Text>
                    {activity.startTime && activity.endTime && (
                      <Text style={styles.activityTime}>
                        🕐 {activity.startTime} - {activity.endTime}
                      </Text>
                    )}
                  </View>
                  <View style={styles.activityAmountBox}>
                    <Text style={styles.activityAmountLabel}>예상 시간</Text>
                    <Text style={styles.activityAmount}>
                      +{minutesToTimeString(activity.earnedMinutes)}
                    </Text>
                  </View>
                </View>
                {activity.description && (
                  <View style={styles.descriptionBox}>
                    <Text style={styles.descriptionLabel}>📝 메모</Text>
                    <Text style={styles.descriptionText}>{activity.description}</Text>
                  </View>
                )}
                <View style={styles.multiplierInfo}>
                  <Text style={styles.multiplierText}>
                    실제 시간 {minutesToTimeString(activity.durationMinutes)} × {activity.multiplier}배
                  </Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.rejectButton, isProcessing && styles.buttonDisabled]}
                    onPress={() => openRejectModal(activity)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.rejectButtonText}>거절</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approveButton, isProcessing && styles.buttonDisabled]}
                    onPress={() => handleApprove(activity)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={COLORS.textWhite} />
                    ) : (
                      <Text style={styles.approveButtonText}>승인</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        {/* 벌금 부과 섹션 */}
        <View style={styles.penaltySection}>
          <Text style={styles.penaltySectionTitle}>⚡ 벌금 부과</Text>
          <Text style={styles.penaltySectionDesc}>규칙 위반 시 시간을 차감해요</Text>

          <View style={styles.penaltyGrid}>
            {PENALTY_ACTIVITIES.map((penalty) => {
              const isSelected = selectedPenalty === penalty.category;
              return (
                <TouchableOpacity
                  key={penalty.category}
                  style={[styles.penaltyCard, isSelected && styles.penaltyCardSelected]}
                  onPress={() => setSelectedPenalty(isSelected ? null : penalty.category)}
                >
                  <Text style={styles.penaltyEmoji}>{penalty.emoji}</Text>
                  <Text style={[styles.penaltyLabel, isSelected && styles.penaltyLabelSelected]}>
                    {penalty.label}
                  </Text>
                  <Text style={styles.penaltyAmount}>
                    -{minutesToTimeString(penalty.fixedMinutes || 0)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedPenalty && (
            <View style={styles.penaltyForm}>
              <TextInput
                style={styles.penaltyInput}
                value={penaltyDescription}
                onChangeText={setPenaltyDescription}
                placeholder="사유 입력 (선택)"
                placeholderTextColor={COLORS.textLight}
              />
              <TouchableOpacity
                style={[styles.penaltyButton, penaltyProcessing && styles.buttonDisabled]}
                onPress={handleAddPenalty}
                disabled={penaltyProcessing}
              >
                {penaltyProcessing ? (
                  <ActivityIndicator size="small" color={COLORS.textWhite} />
                ) : (
                  <Text style={styles.penaltyButtonText}>벌금 부과하기</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRejectModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>❌ 활동 거절</Text>
            <Text style={styles.modalDesc}>거절 사유를 입력해주세요 (선택)</Text>
            <TextInput
              style={styles.reasonInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="예: 확인이 어려워요"
              placeholderTextColor={COLORS.textLight}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalRejectButton}
                onPress={handleReject}
              >
                <Text style={styles.modalRejectText}>거절하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: { padding: SPACING.lg },
  headerTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.textPrimary },
  headerSubtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginTop: SPACING.xs },
  emptyContainer: { alignItems: 'center', padding: SPACING.xxl, marginTop: SPACING.xl },
  emptyEmoji: { fontSize: 80, marginBottom: SPACING.lg },
  emptyTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptyDesc: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  activityCard: { backgroundColor: COLORS.card, marginHorizontal: SPACING.md, marginBottom: SPACING.md, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, ...SHADOWS.medium },
  activityHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  activityEmoji: { width: 50, height: 50, borderRadius: BORDER_RADIUS.lg, backgroundColor: COLORS.earn + '20', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  activityEmojiText: { fontSize: 28 },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.textPrimary },
  activityDate: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  activityTime: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  activityAmountBox: { alignItems: 'flex-end' },
  activityAmountLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  activityAmount: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.earn },
  descriptionBox: { backgroundColor: COLORS.cardAlt, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginTop: SPACING.md },
  descriptionLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  descriptionText: { fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },
  multiplierInfo: { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  multiplierText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, textAlign: 'center' },
  actionButtons: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  rejectButton: { flex: 1, backgroundColor: COLORS.cardAlt, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  rejectButtonText: { color: COLORS.penalty, fontSize: FONT_SIZES.md, fontWeight: '600' },
  approveButton: { flex: 2, backgroundColor: COLORS.earn, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', ...SHADOWS.small },
  approveButtonText: { color: COLORS.textWhite, fontSize: FONT_SIZES.md, fontWeight: 'bold' },
  buttonDisabled: { opacity: 0.7 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  modalContent: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, width: '100%', maxWidth: 360, ...SHADOWS.large },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.textPrimary, textAlign: 'center', marginBottom: SPACING.sm },
  modalDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.lg },
  reasonInput: { backgroundColor: COLORS.cardAlt, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textPrimary, minHeight: 80, textAlignVertical: 'top', marginBottom: SPACING.lg },
  modalButtons: { flexDirection: 'row', gap: SPACING.md },
  modalCancelButton: { flex: 1, backgroundColor: COLORS.cardAlt, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  modalCancelText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md, fontWeight: '600' },
  modalRejectButton: { flex: 1, backgroundColor: COLORS.penalty, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  modalRejectText: { color: COLORS.textWhite, fontSize: FONT_SIZES.md, fontWeight: 'bold' },
  // 벌금 섹션 스타일
  penaltySection: { backgroundColor: COLORS.card, marginHorizontal: SPACING.md, marginTop: SPACING.lg, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, ...SHADOWS.medium },
  penaltySectionTitle: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.textPrimary },
  penaltySectionDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, marginBottom: SPACING.lg },
  penaltyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  penaltyCard: { width: '48%', backgroundColor: COLORS.cardAlt, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  penaltyCardSelected: { borderColor: COLORS.penalty, backgroundColor: COLORS.penalty + '15' },
  penaltyEmoji: { fontSize: 32, marginBottom: SPACING.xs },
  penaltyLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' },
  penaltyLabelSelected: { color: COLORS.penalty },
  penaltyAmount: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.penalty, marginTop: SPACING.xs },
  penaltyForm: { marginTop: SPACING.lg },
  penaltyInput: { backgroundColor: COLORS.cardAlt, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textPrimary, marginBottom: SPACING.md },
  penaltyButton: { backgroundColor: COLORS.penalty, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', ...SHADOWS.small },
  penaltyButtonText: { color: COLORS.textWhite, fontSize: FONT_SIZES.md, fontWeight: 'bold' },
});

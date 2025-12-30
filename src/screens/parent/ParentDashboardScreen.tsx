import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Activity, minutesToTimeString } from '../../types';
import { getActivityConfig } from '../../constants/activities';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/theme';

function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export default function ParentDashboardScreen() {
  const { user, linkToStudent, logout, error, clearError } = useAuth();
  const [studentInfo, setStudentInfo] = useState<{ id: string; name: string } | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [todayActivities, setTodayActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // 연결 모달
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [familyCode, setFamilyCode] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  const isLinked = !!user?.linkedFamilyCode;

  // 학생 정보 및 데이터 로드
  useEffect(() => {
    if (!user?.linkedFamilyCode) {
      setLoading(false);
      return;
    }

    // 학생 정보 가져오기
    const usersRef = collection(db, 'users');
    const studentQuery = query(usersRef, where('familyCode', '==', user.linkedFamilyCode));
    
    const unsubStudent = onSnapshot(studentQuery, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setStudentInfo({ id: doc.id, name: doc.data().name });
      }
    });

    return () => unsubStudent();
  }, [user?.linkedFamilyCode]);

  // 잔액 및 활동 데이터 실시간 구독
  useEffect(() => {
    if (!studentInfo?.id) {
      setLoading(false);
      return;
    }

    // 잔액 구독
    const balanceUnsubscribe = onSnapshot(
      collection(db, 'balances'),
      (snapshot) => {
        const balanceDoc = snapshot.docs.find(doc => doc.id === studentInfo.id);
        if (balanceDoc) {
          setBalance(balanceDoc.data().currentBalance || 0);
        }
      }
    );

    // 활동 구독
    const activitiesRef = collection(db, 'activities');
    const activitiesQuery = query(
      activitiesRef,
      where('userId', '==', studentInfo.id),
      orderBy('createdAt', 'desc')
    );
    
    const activitiesUnsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
      const activities: Activity[] = [];
      let pending = 0;
      const today = new Date().toISOString().split('T')[0];
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const activity: Activity = {
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
        
        // 승인 대기 수 카운트
        if (activity.needsApproval && activity.status === 'pending') {
          pending++;
        }
        
        // 오늘 활동만 필터링
        const activityDate = new Date(activity.date).toISOString().split('T')[0];
        if (activityDate === today) {
          activities.push(activity);
        }
      });
      
      setPendingCount(pending);
      setTodayActivities(activities);
      setLoading(false);
    });

    return () => {
      balanceUnsubscribe();
      activitiesUnsubscribe();
    };
  }, [studentInfo?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  async function handleLink() {
    if (!familyCode.trim()) {
      showAlert('가족 코드를 입력해주세요');
      return;
    }
    
    setLinkLoading(true);
    try {
      await linkToStudent(familyCode.trim().toUpperCase());
      setShowLinkModal(false);
      setFamilyCode('');
      showAlert('연결 완료!', '학생과 연결되었습니다');
    } catch (err) {
      // 에러는 AuthContext에서 처리
    } finally {
      setLinkLoading(false);
    }
  }

  // 연결되지 않은 상태
  if (!isLinked) {
    return (
      <View style={styles.container}>
        <View style={styles.notLinkedContainer}>
          <Text style={styles.notLinkedEmoji}>🔗</Text>
          <Text style={styles.notLinkedTitle}>학생과 연결이 필요해요</Text>
          <Text style={styles.notLinkedDesc}>
            학생 앱의 가족 코드를 입력하여{'\n'}
            아이의 시간 관리를 확인하세요
          </Text>
          
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => setShowLinkModal(true)}
          >
            <Text style={styles.linkButtonText}>학생 연결하기</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={logout}
          >
            <Text style={styles.logoutButtonText}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        {/* 연결 모달 */}
        <Modal
          visible={showLinkModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLinkModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowLinkModal(false)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>🔗 학생 연결</Text>
              <Text style={styles.modalDesc}>
                학생 앱의 설정에서 가족 코드를 확인하고{'\n'}
                아래에 입력해주세요
              </Text>
              
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
              )}
              
              <TextInput
                style={styles.codeInput}
                value={familyCode}
                onChangeText={(text) => {
                  setFamilyCode(text.toUpperCase());
                  clearError();
                }}
                placeholder="가족 코드 6자리"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="characters"
                maxLength={6}
              />
              
              <TouchableOpacity
                style={[styles.modalButton, linkLoading && styles.modalButtonDisabled]}
                onPress={handleLink}
                disabled={linkLoading}
              >
                {linkLoading ? (
                  <ActivityIndicator color={COLORS.textWhite} />
                ) : (
                  <Text style={styles.modalButtonText}>연결하기</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowLinkModal(false);
                  setFamilyCode('');
                  clearError();
                }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>불러오는 중...</Text>
      </View>
    );
  }

  // 오늘 요약 계산
  const todayEarned = todayActivities
    .filter(a => a.type === 'earn')
    .reduce((sum, a) => sum + a.earnedMinutes, 0);
  const todaySpent = todayActivities
    .filter(a => a.type === 'spend')
    .reduce((sum, a) => sum + a.earnedMinutes, 0);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 학생 정보 카드 */}
        <View style={styles.studentCard}>
          <View style={styles.studentHeader}>
            <Text style={styles.studentEmoji}>👦</Text>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{studentInfo?.name || '학생'}</Text>
              <Text style={styles.studentLabel}>연결된 학생</Text>
            </View>
          </View>
          
          {/* 잔액 표시 */}
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>🐷 현재 저금</Text>
            <Text style={[
              styles.balanceValue,
              balance < 0 && styles.balanceNegative
            ]}>
              {minutesToTimeString(balance)}
            </Text>
          </View>
        </View>

        {/* 승인 대기 알림 */}
        {pendingCount > 0 && (
          <TouchableOpacity style={styles.pendingCard}>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
            </View>
            <View style={styles.pendingInfo}>
              <Text style={styles.pendingTitle}>승인 대기 중인 활동</Text>
              <Text style={styles.pendingDesc}>
                확인이 필요한 활동 {pendingCount}개가 있어요
              </Text>
            </View>
            <Text style={styles.pendingArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* 오늘 요약 */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>📊 오늘 요약</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryEmoji}>💰</Text>
              <Text style={styles.summaryLabel}>번 시간</Text>
              <Text style={[styles.summaryValue, styles.earnValue]}>
                +{minutesToTimeString(todayEarned)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryEmoji}>🎮</Text>
              <Text style={styles.summaryLabel}>쓴 시간</Text>
              <Text style={[styles.summaryValue, styles.spendValue]}>
                -{minutesToTimeString(todaySpent)}
              </Text>
            </View>
          </View>
        </View>

        {/* 오늘 활동 목록 */}
        <View style={styles.activitiesCard}>
          <Text style={styles.sectionTitle}>✨ 오늘 활동</Text>
          
          {todayActivities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>오늘 기록이 없어요</Text>
            </View>
          ) : (
            todayActivities.map((activity, index) => {
              const config = getActivityConfig(activity.category);
              const isEarn = activity.type === 'earn';
              const isPending = activity.needsApproval && activity.status === 'pending';
              
              return (
                <View
                  key={activity.id}
                  style={[
                    styles.activityItem,
                    index === todayActivities.length - 1 && styles.activityItemLast,
                  ]}
                >
                  <View style={[
                    styles.activityEmoji,
                    isEarn ? styles.activityEmojiEarn : styles.activityEmojiSpend,
                  ]}>
                    <Text style={styles.activityEmojiText}>{config?.emoji || '📝'}</Text>
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityLabel}>{config?.label || activity.category}</Text>
                    {activity.startTime && activity.endTime && (
                      <Text style={styles.activityTime}>
                        {activity.startTime} - {activity.endTime}
                      </Text>
                    )}
                    {isPending && (
                      <View style={styles.pendingBadgeSmall}>
                        <Text style={styles.pendingBadgeSmallText}>⏳ 승인 대기</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[
                    styles.activityAmount,
                    isEarn ? styles.earnValue : styles.spendValue,
                  ]}>
                    {isEarn ? '+' : '-'}{minutesToTimeString(activity.earnedMinutes)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* 로그아웃 버튼 */}
        <TouchableOpacity
          style={styles.logoutCard}
          onPress={logout}
        >
          <Text style={styles.logoutCardText}>로그아웃</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  notLinkedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  notLinkedEmoji: {
    fontSize: 80,
    marginBottom: SPACING.lg,
  },
  notLinkedTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  notLinkedDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.xl,
  },
  linkButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    ...SHADOWS.medium,
  },
  linkButtonText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  logoutButton: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
  },
  logoutButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  
  // 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 360,
    ...SHADOWS.large,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  modalDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  errorBox: {
    backgroundColor: `${COLORS.error}15`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  codeInput: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 8,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  modalButtonDisabled: {
    opacity: 0.7,
  },
  modalButtonText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  modalCancelButton: {
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  
  // 학생 카드
  studentCard: {
    backgroundColor: COLORS.card,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  studentEmoji: {
    fontSize: 48,
    marginRight: SPACING.md,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  studentLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  balanceBox: {
    backgroundColor: COLORS.goldLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.goldDark,
    marginBottom: SPACING.xs,
  },
  balanceValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.goldDark,
  },
  balanceNegative: {
    color: COLORS.penalty,
  },
  
  // 승인 대기 카드
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.gold}20`,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  pendingBadge: {
    backgroundColor: COLORS.gold,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  pendingBadgeText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  pendingInfo: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.goldDark,
  },
  pendingDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  pendingArrow: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.goldDark,
  },
  
  // 요약 카드
  summaryCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  summaryEmoji: {
    fontSize: 24,
    marginBottom: SPACING.xs,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  summaryValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  earnValue: {
    color: COLORS.earn,
  },
  spendValue: {
    color: COLORS.spend,
  },
  
  // 활동 카드
  activitiesCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activityItemLast: {
    borderBottomWidth: 0,
  },
  activityEmoji: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  activityEmojiEarn: {
    backgroundColor: `${COLORS.earn}20`,
  },
  activityEmojiSpend: {
    backgroundColor: `${COLORS.spend}20`,
  },
  activityEmojiText: {
    fontSize: 20,
  },
  activityInfo: {
    flex: 1,
  },
  activityLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  activityTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  activityAmount: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  pendingBadgeSmall: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  pendingBadgeSmallText: {
    fontSize: 10,
    color: COLORS.textWhite,
    fontWeight: '600',
  },
  
  // 로그아웃
  logoutCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  logoutCardText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
});

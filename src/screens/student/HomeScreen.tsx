import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useActivities } from '../../contexts/ActivityContext';
import { useSchedules } from '../../contexts/ScheduleContext';
import { useAuth } from '../../contexts/AuthContext';
import { minutesToTimeString, Schedule, DayOfWeek } from '../../types';
import { getActivityConfig } from '../../constants/activities';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONT_SIZES, MASCOT } from '../../constants/theme';

function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { balance, todaySummary, loading, addActivity, pendingCount } = useActivities();
  const {
    getTodaySchedules,
    getScheduleStatus,
    markScheduleCompleted,
    markScheduleAbsent,
    resetScheduleStatus,
  } = useSchedules();

  const todaySchedules = getTodaySchedules();
  const todayString = getDateString();

  // 가족 코드 복사
  async function handleCopyFamilyCode() {
    if (user?.familyCode) {
      await Clipboard.setStringAsync(user.familyCode);
      if (Platform.OS === 'web') {
        window.alert('가족 코드가 복사되었습니다!');
      } else {
        Alert.alert('복사 완료', '가족 코드가 클립보드에 복사되었습니다!');
      }
    }
  }

  async function handleCompleteSchedule(schedule: Schedule) {
    const status = getScheduleStatus(schedule.id, todayString);
    if (status?.status === 'completed') {
      Alert.alert('이미 완료됨', '이 스케줄은 이미 기록되었어요');
      return;
    }

    const activity = await addActivity({
      date: new Date(),
      type: 'earn',
      category: schedule.category,
      durationMinutes: schedule.durationMinutes,
      multiplier: schedule.multiplier,
      earnedMinutes: Math.round(schedule.durationMinutes * schedule.multiplier),
      needsApproval: false,
      status: 'approved',
      description: schedule.name,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    });

    await markScheduleCompleted(schedule.id, todayString, activity.id);
    Alert.alert('✅ 기록 완료!', `${schedule.emoji} ${schedule.name}\n+${minutesToTimeString(schedule.durationMinutes)} 벌었어요!`);
  }

  async function handleAbsentSchedule(schedule: Schedule) {
    const status = getScheduleStatus(schedule.id, todayString);
    if (status?.status === 'completed') {
      Alert.alert('이미 완료됨', '이미 기록된 스케줄은 결석 처리할 수 없어요');
      return;
    }

    Alert.alert(
      '결석 처리',
      `${schedule.emoji} ${schedule.name}을(를) 오늘 결석 처리할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '결석 처리',
          style: 'destructive',
          onPress: async () => {
            await markScheduleAbsent(schedule.id, todayString);
          },
        },
      ]
    );
  }

  async function handleResetSchedule(schedule: Schedule) {
    Alert.alert(
      '상태 초기화',
      '이 스케줄의 오늘 상태를 초기화할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          onPress: async () => {
            await resetScheduleStatus(schedule.id, todayString);
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingEmoji}>🐷</Text>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  const isNegative = balance < 0;
  const balanceHours = Math.floor(Math.abs(balance) / 60);

  // 잔액에 따른 마스코트 표정
  const getMascotEmoji = () => {
    if (balance >= 600) return '🤩'; // 10시간 이상
    if (balance >= 180) return '😊'; // 3시간 이상
    if (balance >= 60) return '🙂';  // 1시간 이상
    if (balance > 0) return '😐';    // 1시간 미만
    if (balance === 0) return '😅';  // 0
    return '😰';                      // 마이너스
  };

  // 코인 스택 렌더링 (최대 5개)
  const renderCoinStack = () => {
    const coinCount = Math.min(5, Math.max(0, Math.floor(balance / 60)));
    return (
      <View style={styles.coinStack}>
        {[...Array(coinCount)].map((_, i) => (
          <Text key={i} style={[styles.coin, { marginLeft: i * -8 }]}>
            🪙
          </Text>
        ))}
        {coinCount === 0 && balance >= 0 && <Text style={styles.coin}>🪙</Text>}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 저금통 카드 */}
      <View style={[styles.piggyCard, isNegative && styles.piggyCardNegative]}>
        <View style={styles.piggyHeader}>
          <Text style={styles.piggyEmoji}>{getMascotEmoji()}</Text>
          <View style={styles.piggyInfo}>
            <Text style={styles.piggyLabel}>{user?.name || '나'}의 시간 저금통</Text>
            {renderCoinStack()}
          </View>
        </View>

        <View style={styles.balanceContainer}>
          <Text style={styles.balanceAmount}>
            {isNegative ? '-' : ''}{minutesToTimeString(Math.abs(balance))}
          </Text>
          {isNegative ? (
            <View style={styles.warningBadge}>
              <Text style={styles.warningText}>⚠️ 시간이 부족해요!</Text>
            </View>
          ) : balance >= 600 ? (
            <View style={styles.successBadge}>
              <Text style={styles.successText}>🏆 대단해요!</Text>
            </View>
          ) : null}
        </View>

        {/* 미니 통계 */}
        <View style={styles.miniStats}>
          <View style={styles.miniStatItem}>
            <Text style={styles.miniStatEmoji}>📈</Text>
            <Text style={styles.miniStatValue}>
              +{minutesToTimeString(todaySummary?.earnedMinutes || 0)}
            </Text>
            <Text style={styles.miniStatLabel}>오늘 번 시간</Text>
          </View>
          <View style={styles.miniStatDivider} />
          <View style={styles.miniStatItem}>
            <Text style={styles.miniStatEmoji}>📉</Text>
            <Text style={styles.miniStatValue}>
              -{minutesToTimeString(todaySummary?.spentMinutes || 0)}
            </Text>
            <Text style={styles.miniStatLabel}>오늘 쓴 시간</Text>
          </View>
        </View>
      </View>

      {/* 미승인 활동 알림 */}
      {pendingCount > 0 && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingEmoji}>⏳</Text>
          <View style={styles.pendingInfo}>
            <Text style={styles.pendingTitle}>승인 대기 중</Text>
            <Text style={styles.pendingSubtitle}>
              {pendingCount}개의 활동이 부모님 확인을 기다리고 있어요
            </Text>
          </View>
        </View>
      )}

      {/* 가족 코드 카드 */}
      {user?.familyCode && (
        <View style={styles.familyCodeCard}>
          <View style={styles.familyCodeHeader}>
            <Text style={styles.familyCodeEmoji}>👨‍👩‍👧</Text>
            <View style={styles.familyCodeInfo}>
              <Text style={styles.familyCodeLabel}>나의 가족 코드</Text>
              <Text style={styles.familyCodeHint}>부모님께 이 코드를 알려주세요!</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.familyCodeBox} onPress={handleCopyFamilyCode}>
            <Text style={styles.familyCodeText}>{user.familyCode}</Text>
            <Text style={styles.familyCodeCopy}>📋 복사</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 오늘 스케줄 */}
      {todaySchedules.length > 0 && (
        <View style={styles.scheduleCard}>
          <Text style={styles.scheduleTitle}>🗓️ 오늘 스케줄</Text>
          {todaySchedules.map(schedule => {
            const status = getScheduleStatus(schedule.id, todayString);
            const isCompleted = status?.status === 'completed';
            const isAbsent = status?.status === 'absent';

            return (
              <View key={schedule.id} style={styles.scheduleItem}>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleEmoji}>{schedule.emoji}</Text>
                  <View style={styles.scheduleDetails}>
                    <Text style={[
                      styles.scheduleName,
                      (isCompleted || isAbsent) && styles.scheduleNameDone
                    ]}>
                      {schedule.name}
                    </Text>
                    <Text style={styles.scheduleTime}>
                      {schedule.startTime} - {schedule.endTime}
                    </Text>
                  </View>
                  {isCompleted && (
                    <View style={styles.statusBadgeCompleted}>
                      <Text style={styles.statusBadgeText}>✅ 완료</Text>
                    </View>
                  )}
                  {isAbsent && (
                    <View style={styles.statusBadgeAbsent}>
                      <Text style={styles.statusBadgeText}>❌ 결석</Text>
                    </View>
                  )}
                </View>

                {!isCompleted && !isAbsent ? (
                  <View style={styles.scheduleActions}>
                    <TouchableOpacity
                      style={styles.completeButton}
                      onPress={() => handleCompleteSchedule(schedule)}
                    >
                      <Text style={styles.completeButtonText}>기록하기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.absentButton}
                      onPress={() => handleAbsentSchedule(schedule)}
                    >
                      <Text style={styles.absentButtonText}>결석</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={() => handleResetSchedule(schedule)}
                  >
                    <Text style={styles.resetButtonText}>↩️</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* 오늘 요약 카드 */}
      {todaySummary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>📊 오늘 요약</Text>
          </View>

          <View style={styles.summaryContent}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLeft}>
                <Text style={styles.summaryIcon}>🏦</Text>
                <Text style={styles.summaryLabel}>전날 저금</Text>
              </View>
              <Text style={styles.summaryValue}>
                {minutesToTimeString(todaySummary.previousBalance)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLeft}>
                <Text style={styles.summaryIcon}>💰</Text>
                <Text style={styles.summaryLabel}>번 시간</Text>
              </View>
              <Text style={[styles.summaryValue, styles.earnValue]}>
                +{minutesToTimeString(todaySummary.earnedMinutes)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLeft}>
                <Text style={styles.summaryIcon}>🎮</Text>
                <Text style={styles.summaryLabel}>쓴 시간</Text>
              </View>
              <Text style={[styles.summaryValue, styles.spendValue]}>
                -{minutesToTimeString(todaySummary.spentMinutes)}
              </Text>
            </View>

            {todaySummary.penaltyMinutes > 0 && (
              <View style={styles.summaryRow}>
                <View style={styles.summaryRowLeft}>
                  <Text style={styles.summaryIcon}>⚠️</Text>
                  <Text style={styles.summaryLabel}>벌금</Text>
                </View>
                <Text style={[styles.summaryValue, styles.penaltyValue]}>
                  -{minutesToTimeString(todaySummary.penaltyMinutes)}
                </Text>
              </View>
            )}

            <View style={styles.totalRow}>
              <View style={styles.summaryRowLeft}>
                <Text style={styles.summaryIcon}>🐷</Text>
                <Text style={styles.totalLabel}>현재 저금</Text>
              </View>
              <Text style={styles.totalValue}>
                {minutesToTimeString(todaySummary.currentBalance)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 오늘 활동 목록 */}
      {todaySummary && todaySummary.activities.length > 0 && (
        <View style={styles.activitiesCard}>
          <Text style={styles.activitiesTitle}>✨ 오늘 활동</Text>
          {todaySummary.activities.map((activity, index) => {
            const config = getActivityConfig(activity.category);
            const isEarn = activity.type === 'earn';
            const isSpend = activity.type === 'spend';
            const isPenalty = activity.type === 'penalty';
            const isPending = activity.needsApproval && activity.status === 'pending';
            const isApproved = activity.needsApproval && activity.status === 'approved';
            const isRejected = activity.needsApproval && activity.status === 'rejected';

            return (
              <View
                key={activity.id}
                style={[
                  styles.activityItem,
                  index === todaySummary.activities.length - 1 && styles.activityItemLast,
                ]}
              >
                <View style={[
                  styles.activityEmojiContainer,
                  isEarn && styles.activityEmojiEarn,
                  isSpend && styles.activityEmojiSpend,
                  isPenalty && styles.activityEmojiPenalty,
                ]}>
                  <Text style={styles.activityEmoji}>{config?.emoji || '📝'}</Text>
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityLabel}>
                    {config?.label || activity.category}
                  </Text>
                  {activity.startTime && activity.endTime && (
                    <Text style={styles.activityTime}>
                      {activity.startTime} - {activity.endTime}
                    </Text>
                  )}
                  {activity.needsApproval && (
                    <View style={[
                      styles.approvalBadge,
                      isPending && styles.approvalBadgePending,
                      isApproved && styles.approvalBadgeApproved,
                      isRejected && styles.approvalBadgeRejected,
                    ]}>
                      <Text style={styles.approvalBadgeText}>
                        {isPending ? '⏳ 승인 대기' : isApproved ? '✅ 승인됨' : '❌ 거절됨'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={[
                  styles.activityBadge,
                  isEarn && styles.activityBadgeEarn,
                  isSpend && styles.activityBadgeSpend,
                  isPenalty && styles.activityBadgePenalty,
                ]}>
                  <Text style={styles.activityAmount}>
                    {isEarn ? '+' : '-'}{minutesToTimeString(activity.earnedMinutes)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 활동이 없을 때 */}
      {todaySummary && todaySummary.activities.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyTitle}>오늘 아직 기록이 없어요</Text>
          <Text style={styles.emptySubtitle}>
            아래 '기록' 탭에서 활동을 추가해보세요!
          </Text>
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintText}>
              💡 공부하면 시간을 벌 수 있어요!
            </Text>
          </View>
        </View>
      )}

      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingEmoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
  },

  // 저금통 카드
  piggyCard: {
    backgroundColor: COLORS.earn,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.large,
  },
  piggyCardNegative: {
    backgroundColor: COLORS.penalty,
  },
  piggyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  piggyEmoji: {
    fontSize: 56,
    marginRight: SPACING.md,
  },
  piggyInfo: {
    flex: 1,
  },
  piggyLabel: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  coinStack: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
  },
  coin: {
    fontSize: 24,
  },
  balanceContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  balanceAmount: {
    fontSize: 52,
    fontWeight: 'bold',
    color: COLORS.textWhite,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  warningBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  warningText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  successBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  successText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  miniStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  miniStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  miniStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: SPACING.md,
  },
  miniStatEmoji: {
    fontSize: 20,
    marginBottom: SPACING.xs,
  },
  miniStatValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textWhite,
  },
  miniStatLabel: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // 요약 카드
  summaryCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  summaryHeader: {
    backgroundColor: COLORS.cardAlt,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  summaryTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  summaryContent: {
    padding: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  earnValue: {
    color: COLORS.earn,
  },
  spendValue: {
    color: COLORS.spend,
  },
  penaltyValue: {
    color: COLORS.penalty,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.goldLight,
    borderRadius: BORDER_RADIUS.md,
  },
  totalLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.goldDark,
  },
  totalValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.goldDark,
  },

  // 활동 카드
  activitiesCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  activitiesTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activityItemLast: {
    borderBottomWidth: 0,
  },
  activityEmojiContainer: {
    width: 44,
    height: 44,
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
  activityEmojiPenalty: {
    backgroundColor: `${COLORS.penalty}20`,
  },
  activityEmoji: {
    fontSize: 24,
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
    color: COLORS.textLight,
    marginTop: 2,
  },
  approvalBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginTop: 4,
  },
  approvalBadgePending: {
    backgroundColor: COLORS.gold,
  },
  approvalBadgeApproved: {
    backgroundColor: COLORS.earn,
  },
  approvalBadgeRejected: {
    backgroundColor: COLORS.penalty,
  },
  approvalBadgeText: {
    fontSize: 10,
    color: COLORS.textWhite,
    fontWeight: '600',
  },
  activityBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  activityBadgeEarn: {
    backgroundColor: `${COLORS.earn}20`,
  },
  activityBadgeSpend: {
    backgroundColor: `${COLORS.spend}20`,
  },
  activityBadgePenalty: {
    backgroundColor: `${COLORS.penalty}20`,
  },
  activityAmount: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },

  // 빈 상태
  emptyCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyHint: {
    backgroundColor: COLORS.goldLight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.lg,
  },
  emptyHintText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.goldDark,
    fontWeight: '600',
  },

  // 미승인 알림 카드
  pendingCard: {
    backgroundColor: COLORS.goldLight,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  pendingEmoji: {
    fontSize: 32,
    marginRight: SPACING.md,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.goldDark,
  },
  pendingSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.goldDark,
    marginTop: 2,
  },

  // 가족 코드 카드
  familyCodeCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  familyCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  familyCodeEmoji: {
    fontSize: 32,
    marginRight: SPACING.md,
  },
  familyCodeInfo: {
    flex: 1,
  },
  familyCodeLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  familyCodeHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  familyCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary + '15',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  familyCodeText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 4,
  },
  familyCodeCopy: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // 스케줄 카드
  scheduleCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  scheduleTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  scheduleItem: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  scheduleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  scheduleEmoji: {
    fontSize: 32,
    marginRight: SPACING.md,
  },
  scheduleDetails: {
    flex: 1,
  },
  scheduleName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  scheduleNameDone: {
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },
  scheduleTime: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadgeCompleted: {
    backgroundColor: `${COLORS.earn}20`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusBadgeAbsent: {
    backgroundColor: `${COLORS.textLight}20`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  scheduleActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  completeButton: {
    flex: 1,
    backgroundColor: COLORS.earn,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  completeButtonText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  absentButton: {
    backgroundColor: COLORS.border,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  absentButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  resetButton: {
    alignSelf: 'flex-end',
    padding: SPACING.xs,
  },
  resetButtonText: {
    fontSize: 20,
  },
});

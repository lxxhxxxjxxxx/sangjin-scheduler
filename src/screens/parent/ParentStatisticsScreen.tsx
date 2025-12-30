import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Activity, minutesToTimeString } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/theme';

type PeriodType = 'week' | 'month';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function ParentStatisticsScreen() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('week');

  // 활동 데이터 구독
  React.useEffect(() => {
    if (!user?.linkedFamilyCode) {
      setLoading(false);
      return;
    }

    const activitiesRef = collection(db, 'activities');
    const activitiesQuery = query(
      activitiesRef,
      where('familyCode', '==', user.linkedFamilyCode),
      where('status', '==', 'approved'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
      const loaded: Activity[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          approvedAt: data.approvedAt?.toDate(),
        } as Activity;
      });
      setActivities(loaded);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 기간 계산
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    if (period === 'week') {
      start.setDate(end.getDate() - 6);
    } else {
      start.setDate(end.getDate() - 29);
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [period]);

  // 기간 내 활동 필터
  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      const date = new Date(a.date);
      return date >= dateRange.start && date <= dateRange.end;
    });
  }, [activities, dateRange]);

  // 일별 통계 계산
  const dailyStats = useMemo(() => {
    const days = period === 'week' ? 7 : 30;
    const stats: { date: Date; earned: number; spent: number; penalty: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dayActivities = filteredActivities.filter(a => {
        const aDate = new Date(a.date);
        return aDate.toDateString() === date.toDateString();
      });

      stats.push({
        date,
        earned: dayActivities
          .filter(a => a.type === 'earn')
          .reduce((sum, a) => sum + a.earnedMinutes, 0),
        spent: dayActivities
          .filter(a => a.type === 'spend')
          .reduce((sum, a) => sum + Math.abs(a.earnedMinutes), 0),
        penalty: dayActivities
          .filter(a => a.type === 'penalty')
          .reduce((sum, a) => sum + Math.abs(a.earnedMinutes), 0),
      });
    }

    return stats;
  }, [filteredActivities, period]);

  // 요일별 통계
  const weekdayStats = useMemo(() => {
    const stats = Array(7).fill(0).map((_, i) => ({
      day: i,
      earned: 0,
      count: 0,
    }));

    filteredActivities
      .filter(a => a.type === 'earn')
      .forEach(a => {
        const day = new Date(a.date).getDay();
        stats[day].earned += a.earnedMinutes;
        stats[day].count++;
      });

    return stats;
  }, [filteredActivities]);

  // 과목별 통계
  const subjectStats = useMemo(() => {
    const stats: { [key: string]: number } = {};

    filteredActivities
      .filter(a => a.subject)
      .forEach(a => {
        if (a.subject) {
          stats[a.subject] = (stats[a.subject] || 0) + a.durationMinutes;
        }
      });

    return Object.entries(stats)
      .map(([name, minutes]) => ({ name, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filteredActivities]);

  // 카테고리별 통계
  const categoryStats = useMemo(() => {
    const categoryLabels: { [key: string]: { label: string; emoji: string } } = {
      academy: { label: '학원/과외', emoji: '🏫' },
      homework: { label: '숙제', emoji: '📝' },
      self_study: { label: '스스로 공부', emoji: '📖' },
      reading: { label: '독서', emoji: '📚' },
      good_deed: { label: '좋은 일', emoji: '💝' },
      coding: { label: '코딩/AI', emoji: '💻' },
      game: { label: '게임', emoji: '🎮' },
      youtube: { label: '유튜브', emoji: '📺' },
    };

    const stats: { [key: string]: number } = {};

    filteredActivities.forEach(a => {
      if (a.type === 'earn' || a.type === 'spend') {
        stats[a.category] = (stats[a.category] || 0) + Math.abs(a.earnedMinutes);
      }
    });

    return Object.entries(stats)
      .map(([category, minutes]) => ({
        category,
        label: categoryLabels[category]?.label || category,
        emoji: categoryLabels[category]?.emoji || '📌',
        minutes,
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6);
  }, [filteredActivities]);

  // 총계
  const totals = useMemo(() => {
    const earned = filteredActivities
      .filter(a => a.type === 'earn')
      .reduce((sum, a) => sum + a.earnedMinutes, 0);
    const spent = filteredActivities
      .filter(a => a.type === 'spend')
      .reduce((sum, a) => sum + Math.abs(a.earnedMinutes), 0);
    const penalty = filteredActivities
      .filter(a => a.type === 'penalty')
      .reduce((sum, a) => sum + Math.abs(a.earnedMinutes), 0);

    return { earned, spent, penalty, net: earned - spent - penalty };
  }, [filteredActivities]);

  // 최대값 계산 (차트 스케일용)
  const maxDaily = useMemo(() => {
    return Math.max(...dailyStats.map(d => Math.max(d.earned, d.spent)), 60);
  }, [dailyStats]);

  const maxWeekday = useMemo(() => {
    return Math.max(...weekdayStats.map(d => d.earned), 60);
  }, [weekdayStats]);

  if (!user?.linkedFamilyCode) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🔗</Text>
        <Text style={styles.emptyText}>연결된 학생이 없습니다</Text>
        <Text style={styles.emptySubtext}>설정에서 가족 코드를 입력해주세요</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 기간 선택 */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[styles.periodButton, period === 'week' && styles.periodButtonActive]}
          onPress={() => setPeriod('week')}
        >
          <Text style={[styles.periodButtonText, period === 'week' && styles.periodButtonTextActive]}>
            최근 7일
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === 'month' && styles.periodButtonActive]}
          onPress={() => setPeriod('month')}
        >
          <Text style={[styles.periodButtonText, period === 'month' && styles.periodButtonTextActive]}>
            최근 30일
          </Text>
        </TouchableOpacity>
      </View>

      {/* 총계 카드 */}
      <View style={styles.totalsCard}>
        <Text style={styles.sectionTitle}>📊 기간 총계</Text>
        <View style={styles.totalsGrid}>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>번 시간</Text>
            <Text style={[styles.totalValue, { color: COLORS.earn }]}>
              +{minutesToTimeString(totals.earned)}
            </Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>쓴 시간</Text>
            <Text style={[styles.totalValue, { color: COLORS.spend }]}>
              -{minutesToTimeString(totals.spent)}
            </Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>벌금</Text>
            <Text style={[styles.totalValue, { color: COLORS.penalty }]}>
              -{minutesToTimeString(totals.penalty)}
            </Text>
          </View>
          <View style={[styles.totalItem, styles.totalItemHighlight]}>
            <Text style={styles.totalLabel}>순 변화</Text>
            <Text style={[styles.totalValue, { color: totals.net >= 0 ? COLORS.earn : COLORS.spend }]}>
              {totals.net >= 0 ? '+' : ''}{minutesToTimeString(totals.net)}
            </Text>
          </View>
        </View>
      </View>

      {/* 일별 차트 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 일별 시간 변화</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.earn }]} />
              <Text style={styles.legendText}>번 시간</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.spend }]} />
              <Text style={styles.legendText}>쓴 시간</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.barChart}>
              {dailyStats.map((day, index) => (
                <View key={index} style={styles.barGroup}>
                  <View style={styles.barsContainer}>
                    <View
                      style={[
                        styles.bar,
                        styles.barEarn,
                        { height: Math.max((day.earned / maxDaily) * 100, 2) },
                      ]}
                    />
                    <View
                      style={[
                        styles.bar,
                        styles.barSpend,
                        { height: Math.max((day.spent / maxDaily) * 100, 2) },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>
                    {period === 'week'
                      ? DAY_NAMES[day.date.getDay()]
                      : `${day.date.getMonth() + 1}/${day.date.getDate()}`}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* 요일별 통계 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📅 요일별 평균 (번 시간)</Text>
        <View style={styles.weekdayChart}>
          {weekdayStats.map((stat, index) => (
            <View key={index} style={styles.weekdayBar}>
              <View style={styles.weekdayBarContainer}>
                <View
                  style={[
                    styles.weekdayBarFill,
                    { height: `${Math.max((stat.earned / maxWeekday) * 100, 5)}%` },
                  ]}
                />
              </View>
              <Text style={[
                styles.weekdayLabel,
                (index === 0 || index === 6) && styles.weekendLabel,
              ]}>
                {DAY_NAMES[index]}
              </Text>
              <Text style={styles.weekdayValue}>
                {stat.earned > 0 ? minutesToTimeString(stat.earned) : '-'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 과목별 통계 */}
      {subjectStats.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📚 과목별 공부 시간</Text>
          <View style={styles.subjectList}>
            {subjectStats.map((stat, index) => {
              const maxMinutes = subjectStats[0]?.minutes || 1;
              const percentage = (stat.minutes / maxMinutes) * 100;
              return (
                <View key={index} style={styles.subjectItem}>
                  <View style={styles.subjectInfo}>
                    <Text style={styles.subjectName}>{stat.name}</Text>
                    <Text style={styles.subjectTime}>{minutesToTimeString(stat.minutes)}</Text>
                  </View>
                  <View style={styles.subjectBarContainer}>
                    <View
                      style={[styles.subjectBarFill, { width: `${percentage}%` }]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 카테고리별 통계 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏷️ 활동별 시간</Text>
        <View style={styles.categoryGrid}>
          {categoryStats.map((stat, index) => (
            <View key={index} style={styles.categoryItem}>
              <Text style={styles.categoryEmoji}>{stat.emoji}</Text>
              <Text style={styles.categoryLabel}>{stat.label}</Text>
              <Text style={styles.categoryTime}>{minutesToTimeString(stat.minutes)}</Text>
            </View>
          ))}
        </View>
        {categoryStats.length === 0 && (
          <Text style={styles.noDataText}>기간 내 활동이 없습니다</Text>
        )}
      </View>

      <View style={{ height: SPACING.xxl }} />
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // 기간 선택
  periodSelector: {
    flexDirection: 'row',
    margin: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xs,
    ...SHADOWS.small,
  },
  periodButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
  },
  periodButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  periodButtonTextActive: {
    color: COLORS.textWhite,
  },

  // 총계 카드
  totalsCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  totalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  totalItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.cardAlt,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  totalItemHighlight: {
    backgroundColor: COLORS.goldLight,
  },
  totalLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  totalValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },

  // 섹션
  section: {
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

  // 차트 범례
  chartContainer: {
    gap: SPACING.sm,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },

  // 막대 차트
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: SPACING.sm,
    gap: SPACING.xs,
  },
  barGroup: {
    alignItems: 'center',
    width: 36,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: 2,
  },
  bar: {
    width: 14,
    borderRadius: 4,
    minHeight: 2,
  },
  barEarn: {
    backgroundColor: COLORS.earn,
  },
  barSpend: {
    backgroundColor: COLORS.spend,
  },
  barLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // 요일별 차트
  weekdayChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
  },
  weekdayBar: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayBarContainer: {
    width: 28,
    height: 80,
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekdayBarFill: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  weekdayLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  weekendLabel: {
    color: COLORS.spend,
  },
  weekdayValue: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // 과목별
  subjectList: {
    gap: SPACING.md,
  },
  subjectItem: {
    gap: SPACING.xs,
  },
  subjectInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  subjectTime: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  subjectBarContainer: {
    height: 8,
    backgroundColor: COLORS.cardAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  subjectBarFill: {
    height: '100%',
    backgroundColor: COLORS.earn,
    borderRadius: 4,
  },

  // 카테고리별
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryItem: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: COLORS.cardAlt,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  categoryEmoji: {
    fontSize: 28,
    marginBottom: SPACING.xs,
  },
  categoryLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  categoryTime: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  noDataText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    paddingVertical: SPACING.lg,
  },
});

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { Calendar } from 'react-native-calendars';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Activity, minutesToTimeString } from '../../types';
import { getActivityConfig } from '../../constants/activities';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/theme';

type PeriodType = 'week' | 'month' | 'custom';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function ParentStatisticsScreen() {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('week');

  // 커스텀 기간 선택
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectingDate, setSelectingDate] = useState<'start' | 'end'>('start');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return date.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // 활동 데이터 구독
  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // 부모는 linkedFamilyCode로, 학생은 familyCode로 조회 (동일한 데이터 공유)
    const activitiesRef = collection(db, 'activities');
    const familyCodeToUse = isParent ? user.linkedFamilyCode : user.familyCode;

    if (!familyCodeToUse) {
      setLoading(false);
      return;
    }

    const activitiesQuery = query(
      activitiesRef,
      where('familyCode', '==', familyCodeToUse),
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
  }, [user, isParent]);

  // 기간 계산
  const dateRange = useMemo(() => {
    if (period === 'custom') {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

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
  }, [period, customStartDate, customEndDate]);

  // 커스텀 기간의 일수 계산
  const customDays = useMemo(() => {
    if (period !== 'custom') return 0;
    const diffTime = Math.abs(new Date(customEndDate).getTime() - new Date(customStartDate).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [period, customStartDate, customEndDate]);

  // 기간 내 활동 필터
  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      const date = new Date(a.date);
      return date >= dateRange.start && date <= dateRange.end;
    });
  }, [activities, dateRange]);

  // 일별 통계 계산
  const dailyStats = useMemo(() => {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : customDays;
    const stats: { date: Date; earned: number; spent: number; penalty: number }[] = [];

    const startDate = period === 'custom' ? new Date(customStartDate) : new Date();
    if (period !== 'custom') {
      startDate.setDate(startDate.getDate() - (days - 1));
    }

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
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
  }, [filteredActivities, period, customDays, customStartDate]);

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

  // 과목별 일별 추이 (최근 7일)
  const subjectDailyTrend = useMemo(() => {
    // 상위 5개 과목만 추출
    const topSubjects = subjectStats.slice(0, 5).map(s => s.name);
    if (topSubjects.length === 0) return [];

    const days = Math.min(period === 'week' ? 7 : period === 'month' ? 14 : Math.min(customDays, 14), 14);
    const startDate = period === 'custom' ? new Date(customStartDate) : new Date();
    if (period !== 'custom') {
      startDate.setDate(startDate.getDate() - (days - 1));
    }

    const trend: { date: Date; subjects: { [key: string]: number } }[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const dayData: { [key: string]: number } = {};
      topSubjects.forEach(subject => {
        dayData[subject] = 0;
      });

      filteredActivities
        .filter(a => a.subject && topSubjects.includes(a.subject))
        .forEach(a => {
          const aDate = new Date(a.date);
          if (aDate.toDateString() === date.toDateString()) {
            dayData[a.subject!] = (dayData[a.subject!] || 0) + a.durationMinutes;
          }
        });

      trend.push({ date, subjects: dayData });
    }

    return trend;
  }, [filteredActivities, subjectStats, period, customDays, customStartDate]);

  // 과목 색상 생성
  const subjectColors = useMemo(() => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const colorMap: { [key: string]: string } = {};
    subjectStats.forEach((stat, index) => {
      colorMap[stat.name] = colors[index % colors.length];
    });
    return colorMap;
  }, [subjectStats]);

  // 카테고리별 통계
  const categoryStats = useMemo(() => {
    const stats: { [key: string]: number } = {};

    filteredActivities.forEach(a => {
      if (a.type === 'earn' || a.type === 'spend') {
        stats[a.category] = (stats[a.category] || 0) + Math.abs(a.earnedMinutes);
      }
    });

    return Object.entries(stats)
      .map(([category, minutes]) => {
        const config = getActivityConfig(category as any);
        return {
          category,
          label: config?.label || category,
          emoji: config?.emoji || '📌',
          minutes,
        };
      })
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 8);
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

  const familyCodeToUse = isParent ? user?.linkedFamilyCode : user?.familyCode;

  if (!familyCodeToUse) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🔗</Text>
        <Text style={styles.emptyText}>
          {isParent ? '연결된 학생이 없습니다' : '가족 코드가 없습니다'}
        </Text>
        <Text style={styles.emptySubtext}>
          {isParent ? '설정에서 가족 코드를 입력해주세요' : '설정에서 가족 코드를 확인해주세요'}
        </Text>
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
            7일
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === 'month' && styles.periodButtonActive]}
          onPress={() => setPeriod('month')}
        >
          <Text style={[styles.periodButtonText, period === 'month' && styles.periodButtonTextActive]}>
            30일
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === 'custom' && styles.periodButtonActive]}
          onPress={() => setPeriod('custom')}
        >
          <Text style={[styles.periodButtonText, period === 'custom' && styles.periodButtonTextActive]}>
            기간 선택
          </Text>
        </TouchableOpacity>
      </View>

      {/* 커스텀 기간 표시 및 선택 */}
      {period === 'custom' && (
        <View style={styles.customDateContainer}>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => {
              setSelectingDate('start');
              setShowDateModal(true);
            }}
          >
            <Text style={styles.datePickerLabel}>시작일</Text>
            <Text style={styles.datePickerValue}>{customStartDate}</Text>
          </TouchableOpacity>
          <Text style={styles.dateSeparator}>~</Text>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => {
              setSelectingDate('end');
              setShowDateModal(true);
            }}
          >
            <Text style={styles.datePickerLabel}>종료일</Text>
            <Text style={styles.datePickerValue}>{customEndDate}</Text>
          </TouchableOpacity>
        </View>
      )}

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
                  {period === 'custom' && customDays <= 14 && (
                    <Text style={styles.barLabelDay}>{DAY_NAMES[day.date.getDay()]}</Text>
                  )}
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
          <Text style={styles.sectionTitle}>📚 과목별 공부 시간 순위</Text>

          {/* 순위 카드 */}
          <View style={styles.subjectRankContainer}>
            {subjectStats.slice(0, 3).map((stat, index) => {
              const medals = ['🥇', '🥈', '🥉'];
              const totalMinutes = subjectStats.reduce((sum, s) => sum + s.minutes, 0);
              const percentage = totalMinutes > 0 ? Math.round((stat.minutes / totalMinutes) * 100) : 0;
              return (
                <View key={index} style={[styles.subjectRankCard, index === 0 && styles.subjectRankCardFirst]}>
                  <Text style={styles.subjectRankMedal}>{medals[index]}</Text>
                  <Text style={[styles.subjectRankName, index === 0 && styles.subjectRankNameFirst]} numberOfLines={1}>
                    {stat.name}
                  </Text>
                  <Text style={[styles.subjectRankTime, { color: subjectColors[stat.name] }]}>
                    {minutesToTimeString(stat.minutes)}
                  </Text>
                  <Text style={styles.subjectRankPercent}>{percentage}%</Text>
                </View>
              );
            })}
          </View>

          {/* 전체 과목 리스트 */}
          <View style={styles.subjectList}>
            {subjectStats.map((stat, index) => {
              const maxMinutes = subjectStats[0]?.minutes || 1;
              const percentage = (stat.minutes / maxMinutes) * 100;
              return (
                <View key={index} style={styles.subjectItem}>
                  <View style={[styles.subjectColorDot, { backgroundColor: subjectColors[stat.name] }]} />
                  <View style={styles.subjectInfo}>
                    <Text style={styles.subjectName}>{stat.name}</Text>
                    <Text style={styles.subjectTime}>{minutesToTimeString(stat.minutes)}</Text>
                  </View>
                  <View style={styles.subjectBarContainer}>
                    <View
                      style={[styles.subjectBarFill, { width: `${percentage}%`, backgroundColor: subjectColors[stat.name] }]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 과목별 일일 추이 */}
      {subjectDailyTrend.length > 0 && subjectStats.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 과목별 일일 추이</Text>

          {/* 범례 */}
          <View style={styles.subjectLegend}>
            {subjectStats.slice(0, 5).map((stat, index) => (
              <View key={index} style={styles.subjectLegendItem}>
                <View style={[styles.subjectLegendDot, { backgroundColor: subjectColors[stat.name] }]} />
                <Text style={styles.subjectLegendText} numberOfLines={1}>{stat.name}</Text>
              </View>
            ))}
          </View>

          {/* 추이 차트 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.subjectTrendChart}>
              {subjectDailyTrend.map((day, dayIndex) => {
                const totalMinutes = Object.values(day.subjects).reduce((sum, m) => sum + m, 0);
                const maxTotalMinutes = Math.max(...subjectDailyTrend.map(d =>
                  Object.values(d.subjects).reduce((sum, m) => sum + m, 0)
                ), 60);

                return (
                  <View key={dayIndex} style={styles.subjectTrendDay}>
                    <View style={styles.subjectTrendBarContainer}>
                      {subjectStats.slice(0, 5).map((stat, statIndex) => {
                        const minutes = day.subjects[stat.name] || 0;
                        const height = maxTotalMinutes > 0 ? (minutes / maxTotalMinutes) * 80 : 0;
                        return (
                          <View
                            key={statIndex}
                            style={[
                              styles.subjectTrendBarSegment,
                              {
                                height: Math.max(height, minutes > 0 ? 4 : 0),
                                backgroundColor: subjectColors[stat.name],
                              }
                            ]}
                          />
                        );
                      })}
                    </View>
                    <Text style={styles.subjectTrendLabel}>
                      {day.date.getMonth() + 1}/{day.date.getDate()}
                    </Text>
                    {totalMinutes > 0 && (
                      <Text style={styles.subjectTrendValue}>{Math.round(totalMinutes)}분</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
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

      {/* 날짜 선택 모달 */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>
              📅 {selectingDate === 'start' ? '시작일' : '종료일'} 선택
            </Text>
            <Calendar
              current={selectingDate === 'start' ? customStartDate : customEndDate}
              maxDate={selectingDate === 'start' ? customEndDate : new Date().toISOString().split('T')[0]}
              minDate={selectingDate === 'end' ? customStartDate : undefined}
              onDayPress={(day: { dateString: string }) => {
                if (selectingDate === 'start') {
                  setCustomStartDate(day.dateString);
                } else {
                  setCustomEndDate(day.dateString);
                }
                setShowDateModal(false);
              }}
              markedDates={{
                [selectingDate === 'start' ? customStartDate : customEndDate]: {
                  selected: true,
                  selectedColor: COLORS.primary,
                },
              }}
              theme={{
                backgroundColor: COLORS.card,
                calendarBackground: COLORS.card,
                textSectionTitleColor: COLORS.textSecondary,
                selectedDayBackgroundColor: COLORS.primary,
                selectedDayTextColor: COLORS.textWhite,
                todayTextColor: COLORS.primary,
                dayTextColor: COLORS.textPrimary,
                textDisabledColor: COLORS.textLight,
                monthTextColor: COLORS.textPrimary,
                arrowColor: COLORS.primary,
              }}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDateModal(false)}
            >
              <Text style={styles.modalCloseText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  barLabelDay: {
    fontSize: 8,
    color: COLORS.textLight,
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

  // 과목별 순위
  subjectRankContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  subjectRankCard: {
    flex: 1,
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  subjectRankCardFirst: {
    backgroundColor: COLORS.goldLight,
  },
  subjectRankMedal: {
    fontSize: 28,
    marginBottom: SPACING.xs,
  },
  subjectRankName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subjectRankNameFirst: {
    color: COLORS.goldDark,
  },
  subjectRankTime: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    marginTop: SPACING.xs,
  },
  subjectRankPercent: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },

  // 과목별 리스트
  subjectList: {
    gap: SPACING.md,
  },
  subjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  subjectColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  subjectInfo: {
    flex: 1,
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
    flex: 1,
    height: 8,
    backgroundColor: COLORS.cardAlt,
    borderRadius: 4,
    overflow: 'hidden',
    marginLeft: SPACING.sm,
  },
  subjectBarFill: {
    height: '100%',
    backgroundColor: COLORS.earn,
    borderRadius: 4,
  },

  // 과목별 범례
  subjectLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  subjectLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subjectLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subjectLegendText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    maxWidth: 60,
  },

  // 과목별 추이 차트
  subjectTrendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: SPACING.xs,
    paddingTop: SPACING.sm,
  },
  subjectTrendDay: {
    alignItems: 'center',
    width: 40,
  },
  subjectTrendBarContainer: {
    width: 24,
    height: 80,
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
  },
  subjectTrendBarSegment: {
    width: '100%',
  },
  subjectTrendLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  subjectTrendValue: {
    fontSize: 8,
    color: COLORS.textLight,
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

  // 커스텀 날짜 선택
  customDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  datePickerButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  datePickerLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  datePickerValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  dateSeparator: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
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
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 360,
    ...SHADOWS.large,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  modalCloseButton: {
    backgroundColor: COLORS.cardAlt,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  modalCloseText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});

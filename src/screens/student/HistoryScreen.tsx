import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Calendar, LocaleConfig } from 'react-native-calendars';

// 웹 호환 Alert
function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

// 웹 호환 Confirm
function showConfirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: onConfirm },
    ]);
  }
}
import { useActivities } from '../../contexts/ActivityContext';
import { minutesToTimeString, Activity } from '../../types';
import { getActivityConfig } from '../../constants/activities';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/theme';

// 한국어 설정
LocaleConfig.locales['kr'] = {
  monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'kr';

type StatsPeriod = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom';

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  thisWeek: '이번 주',
  lastWeek: '지난 주',
  thisMonth: '이번 달',
  lastMonth: '지난 달',
  custom: '직접 선택',
};

export default function HistoryScreen() {
  const { activities, getDailySummary, deleteActivity } = useActivities();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [showCalendar, setShowCalendar] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('thisWeek');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectingDateFor, setSelectingDateFor] = useState<'start' | 'end' | null>(null);

  // 활동이 있는 날짜들 마킹
  const markedDates = useMemo(() => {
    const marks: { [date: string]: any } = {};

    activities.forEach((activity) => {
      const date = new Date(activity.date).toISOString().split('T')[0];
      if (!marks[date]) {
        marks[date] = {
          marked: true,
          dotColor: COLORS.earn,
        };
      }
    });

    // 선택된 날짜 표시
    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: COLORS.primary,
    };

    return marks;
  }, [activities, selectedDate]);

  // 최근 7일 빠른 선택
  const recentDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  // 활동이 있는 날짜 그룹
  const dateGroups = useMemo(() => {
    const groups: { [date: string]: Activity[] } = {};
    activities.forEach((activity) => {
      const date = new Date(activity.date).toISOString().split('T')[0];
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });
    return groups;
  }, [activities]);

  // 기간별 통계 계산
  const periodStats = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (statsPeriod) {
      case 'thisWeek': {
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 월요일 시작
        startDate = new Date(now);
        startDate.setDate(now.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      case 'lastWeek': {
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - diff - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      case 'thisMonth': {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      case 'lastMonth': {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      case 'custom': {
        startDate = new Date(customStartDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
    }

    const periodActivities = activities.filter(a => {
      const actDate = new Date(a.date);
      return actDate >= startDate && actDate <= endDate;
    });

    let earnedMinutes = 0;
    let spentMinutes = 0;
    let penaltyMinutes = 0;
    let daysWithActivity = new Set<string>();

    periodActivities.forEach(a => {
      const dateStr = new Date(a.date).toISOString().split('T')[0];
      daysWithActivity.add(dateStr);

      if (a.type === 'earn') {
        earnedMinutes += a.earnedMinutes;
      } else if (a.type === 'spend') {
        spentMinutes += a.earnedMinutes;
      } else if (a.type === 'penalty') {
        penaltyMinutes += a.earnedMinutes;
      }
    });

    const netChange = earnedMinutes - spentMinutes - penaltyMinutes;

    // 기간 문자열 생성
    const formatPeriodDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    const periodStr = `${formatPeriodDate(startDate)} ~ ${formatPeriodDate(endDate)}`;

    return {
      earnedMinutes,
      spentMinutes,
      penaltyMinutes,
      netChange,
      activityCount: periodActivities.length,
      daysWithActivity: daysWithActivity.size,
      periodStr,
    };
  }, [activities, statsPeriod, customStartDate, customEndDate]);

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (dateStr === today) return '오늘';
    if (dateStr === yesterday) return '어제';

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}/${day} (${weekday})`;
  }

  function formatFullDate(dateStr: string): string {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekday})`;
  }

  function handleDeleteActivity(activity: Activity) {
    const config = getActivityConfig(activity.category);
    showConfirm(
      '🗑️ 삭제할까요?',
      `"${config?.label || activity.category}" 기록을 삭제하면 시간도 되돌아가요.`,
      () => {
        deleteActivity(activity.id);
        showAlert('삭제 완료', '기록이 삭제되었어요');
      }
    );
  }

  function getKakaoText(): string {
    return `${formatDate(selectedDate)}

전날 저금 : ${minutesToTimeString(summary.previousBalance)}

번 시간 : ${minutesToTimeString(summary.earnedMinutes)}${summary.activities
      .filter((a) => a.type === 'earn')
      .map((a) => {
        const config = getActivityConfig(a.category);
        return `\n${a.startTime || ''}-${a.endTime || ''} ${config?.label || a.category} ${minutesToTimeString(a.durationMinutes)}`;
      })
      .join('')}

쓴 시간 : ${minutesToTimeString(summary.spentMinutes)}${summary.activities
      .filter((a) => a.type === 'spend')
      .map((a) => {
        const config = getActivityConfig(a.category);
        return `\n${a.startTime || ''}-${a.endTime || ''} ${config?.label || a.category} ${minutesToTimeString(a.durationMinutes)}`;
      })
      .join('')}

오늘 저금 : ${minutesToTimeString(summary.previousBalance)} + ${minutesToTimeString(summary.earnedMinutes)} - ${minutesToTimeString(summary.spentMinutes)} = ${minutesToTimeString(summary.currentBalance)}`;
  }

  async function handleCopyKakao() {
    const text = getKakaoText();
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        showAlert('복사 완료!', '클립보드에 복사되었어요');
      } catch {
        showAlert('복사 실패', '클립보드 복사에 실패했어요');
      }
    } else {
      await Clipboard.setStringAsync(text);
      showAlert('복사 완료!', '클립보드에 복사되었어요');
    }
  }

  const summary = getDailySummary(selectedDate);

  return (
    <View style={styles.container}>
      {/* 날짜 선택 바 */}
      <View style={styles.dateBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateScrollContent}
        >
          {recentDates.map((date) => {
            const isSelected = date === selectedDate;
            const hasActivities = dateGroups[date]?.length > 0;
            return (
              <TouchableOpacity
                key={date}
                style={[styles.dateButton, isSelected && styles.dateButtonSelected]}
                onPress={() => setSelectedDate(date)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateText, isSelected && styles.dateTextSelected]}>
                  {formatDate(date)}
                </Text>
                {hasActivities && (
                  <View style={[styles.dateDot, isSelected && styles.dateDotSelected]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 통계 버튼 */}
        <TouchableOpacity
          style={styles.statsButton}
          onPress={() => setShowStats(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.statsButtonText}>📊</Text>
        </TouchableOpacity>

        {/* 달력 버튼 */}
        <TouchableOpacity
          style={styles.calendarButton}
          onPress={() => setShowCalendar(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.calendarButtonText}>📅</Text>
        </TouchableOpacity>
      </View>

      {/* 통계 모달 */}
      <Modal
        visible={showStats}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStats(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStats(false)}
        >
          <View style={styles.statsContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsTitle}>📊 기간별 통계</Text>
              <TouchableOpacity onPress={() => setShowStats(false)}>
                <Text style={styles.statsClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 기간 선택 */}
            <View style={styles.periodSelector}>
              {(Object.keys(PERIOD_LABELS) as StatsPeriod[]).map(period => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    statsPeriod === period && styles.periodButtonActive,
                  ]}
                  onPress={() => setStatsPeriod(period)}
                >
                  <Text style={[
                    styles.periodButtonText,
                    statsPeriod === period && styles.periodButtonTextActive,
                  ]}>
                    {PERIOD_LABELS[period]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 사용자 지정 기간 선택 */}
            {statsPeriod === 'custom' && (
              <View style={styles.customDateRow}>
                <TouchableOpacity
                  style={styles.customDateButton}
                  onPress={() => setSelectingDateFor('start')}
                >
                  <Text style={styles.customDateButtonText}>
                    {customStartDate.split('-').slice(1).join('/')}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.customDateArrow}>~</Text>
                <TouchableOpacity
                  style={styles.customDateButton}
                  onPress={() => setSelectingDateFor('end')}
                >
                  <Text style={styles.customDateButtonText}>
                    {customEndDate.split('-').slice(1).join('/')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.periodRange}>{periodStats.periodStr}</Text>

            {/* 통계 카드들 */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, styles.statCardEarn]}>
                <Text style={styles.statCardEmoji}>💰</Text>
                <Text style={styles.statCardLabel}>번 시간</Text>
                <Text style={[styles.statCardValue, { color: COLORS.earn }]}>
                  +{minutesToTimeString(periodStats.earnedMinutes)}
                </Text>
              </View>

              <View style={[styles.statCard, styles.statCardSpend]}>
                <Text style={styles.statCardEmoji}>🎮</Text>
                <Text style={styles.statCardLabel}>쓴 시간</Text>
                <Text style={[styles.statCardValue, { color: COLORS.spend }]}>
                  -{minutesToTimeString(periodStats.spentMinutes)}
                </Text>
              </View>

              {periodStats.penaltyMinutes > 0 && (
                <View style={[styles.statCard, styles.statCardPenalty]}>
                  <Text style={styles.statCardEmoji}>⚠️</Text>
                  <Text style={styles.statCardLabel}>벌금</Text>
                  <Text style={[styles.statCardValue, { color: COLORS.penalty }]}>
                    -{minutesToTimeString(periodStats.penaltyMinutes)}
                  </Text>
                </View>
              )}

              <View style={[styles.statCard, styles.statCardNet]}>
                <Text style={styles.statCardEmoji}>📈</Text>
                <Text style={styles.statCardLabel}>순 변동</Text>
                <Text style={[
                  styles.statCardValue,
                  { color: periodStats.netChange >= 0 ? COLORS.earn : COLORS.penalty }
                ]}>
                  {periodStats.netChange >= 0 ? '+' : ''}{minutesToTimeString(periodStats.netChange)}
                </Text>
              </View>
            </View>

            {/* 추가 정보 */}
            <View style={styles.statsExtra}>
              <View style={styles.statsExtraItem}>
                <Text style={styles.statsExtraLabel}>기록한 날</Text>
                <Text style={styles.statsExtraValue}>{periodStats.daysWithActivity}일</Text>
              </View>
              <View style={styles.statsExtraItem}>
                <Text style={styles.statsExtraLabel}>총 활동 수</Text>
                <Text style={styles.statsExtraValue}>{periodStats.activityCount}개</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 사용자 지정 날짜 선택 모달 */}
      <Modal
        visible={selectingDateFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectingDateFor(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectingDateFor(null)}
        >
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>
                📅 {selectingDateFor === 'start' ? '시작 날짜' : '종료 날짜'} 선택
              </Text>
              <TouchableOpacity onPress={() => setSelectingDateFor(null)}>
                <Text style={styles.calendarClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Calendar
              current={selectingDateFor === 'start' ? customStartDate : customEndDate}
              markedDates={{
                [selectingDateFor === 'start' ? customStartDate : customEndDate]: {
                  selected: true,
                  selectedColor: COLORS.primary,
                },
              }}
              onDayPress={(day) => {
                if (selectingDateFor === 'start') {
                  setCustomStartDate(day.dateString);
                  if (day.dateString > customEndDate) {
                    setCustomEndDate(day.dateString);
                  }
                } else {
                  setCustomEndDate(day.dateString);
                  if (day.dateString < customStartDate) {
                    setCustomStartDate(day.dateString);
                  }
                }
                setSelectingDateFor(null);
              }}
              maxDate={new Date().toISOString().split('T')[0]}
              theme={{
                backgroundColor: COLORS.card,
                calendarBackground: COLORS.card,
                textSectionTitleColor: COLORS.textSecondary,
                selectedDayBackgroundColor: COLORS.primary,
                selectedDayTextColor: COLORS.textWhite,
                todayTextColor: COLORS.primary,
                dayTextColor: COLORS.textPrimary,
                textDisabledColor: COLORS.textLight,
                arrowColor: COLORS.primary,
                monthTextColor: COLORS.textPrimary,
                textDayFontWeight: '500',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '600',
                textDayFontSize: 16,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14,
              }}
              style={styles.calendar}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 달력 모달 */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCalendar(false)}
        >
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>📅 날짜 선택</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Text style={styles.calendarClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Calendar
              current={selectedDate}
              markedDates={markedDates}
              onDayPress={(day) => {
                setSelectedDate(day.dateString);
                setShowCalendar(false);
              }}
              maxDate={new Date().toISOString().split('T')[0]}
              theme={{
                backgroundColor: COLORS.card,
                calendarBackground: COLORS.card,
                textSectionTitleColor: COLORS.textSecondary,
                selectedDayBackgroundColor: COLORS.primary,
                selectedDayTextColor: COLORS.textWhite,
                todayTextColor: COLORS.primary,
                dayTextColor: COLORS.textPrimary,
                textDisabledColor: COLORS.textLight,
                dotColor: COLORS.earn,
                selectedDotColor: COLORS.textWhite,
                arrowColor: COLORS.primary,
                monthTextColor: COLORS.textPrimary,
                textDayFontWeight: '500',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '600',
                textDayFontSize: 16,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14,
              }}
              style={styles.calendar}
            />
            <View style={styles.calendarLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.earn }]} />
                <Text style={styles.legendText}>기록 있음</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
                <Text style={styles.legendText}>선택됨</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
        {/* 선택된 날짜 표시 */}
        <View style={styles.selectedDateCard}>
          <Text style={styles.selectedDateText}>{formatFullDate(selectedDate)}</Text>
        </View>

        {/* 일별 요약 */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>📊 요약</Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryEmoji}>🏦</Text>
              <Text style={styles.summaryLabel}>전날 저금</Text>
              <Text style={styles.summaryValue}>
                {minutesToTimeString(summary.previousBalance)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryEmoji}>💰</Text>
              <Text style={styles.summaryLabel}>번 시간</Text>
              <Text style={[styles.summaryValue, styles.earnValue]}>
                +{minutesToTimeString(summary.earnedMinutes)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryEmoji}>🎮</Text>
              <Text style={styles.summaryLabel}>쓴 시간</Text>
              <Text style={[styles.summaryValue, styles.spendValue]}>
                -{minutesToTimeString(summary.spentMinutes)}
              </Text>
            </View>
            <View style={[styles.summaryItem, styles.summaryItemHighlight]}>
              <Text style={styles.summaryEmoji}>🐷</Text>
              <Text style={styles.summaryLabel}>현재 저금</Text>
              <Text style={styles.summaryValueBig}>
                {minutesToTimeString(summary.currentBalance)}
              </Text>
            </View>
          </View>
        </View>

        {/* 활동 목록 */}
        <View style={styles.activitiesCard}>
          <Text style={styles.activitiesTitle}>✨ 활동 기록</Text>

          {summary.activities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>이 날은 기록이 없어요</Text>
            </View>
          ) : (
            summary.activities.map((activity, index) => {
              const config = getActivityConfig(activity.category);
              const isEarn = activity.type === 'earn';
              const isSpend = activity.type === 'spend';
              const isPenalty = activity.type === 'penalty';

              return (
                <View
                  key={activity.id}
                  style={[
                    styles.activityItem,
                    index === summary.activities.length - 1 && styles.activityItemLast,
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
                    <View style={styles.activityMeta}>
                      {activity.startTime && activity.endTime && (
                        <Text style={styles.activityTime}>
                          🕐 {activity.startTime} - {activity.endTime}
                        </Text>
                      )}
                      {activity.needsApproval && (
                        <View
                          style={[
                            styles.statusBadge,
                            activity.status === 'approved' && styles.statusApproved,
                            activity.status === 'rejected' && styles.statusRejected,
                          ]}
                        >
                          <Text style={styles.statusText}>
                            {activity.status === 'pending'
                              ? '⏳ 확인 대기'
                              : activity.status === 'approved'
                              ? '✅ 승인됨'
                              : '❌ 거절됨'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {activity.description && (
                      <Text style={styles.activityDescription}>📝 {activity.description}</Text>
                    )}
                  </View>
                  <View style={styles.activityRight}>
                    <View style={[
                      styles.activityBadge,
                      isEarn && styles.activityBadgeEarn,
                      isSpend && styles.activityBadgeSpend,
                      isPenalty && styles.activityBadgePenalty,
                    ]}>
                      <Text style={[
                        styles.activityAmount,
                        isEarn && styles.earnValue,
                        isSpend && styles.spendValue,
                        isPenalty && styles.penaltyValue,
                      ]}>
                        {isEarn ? '+' : '-'}{minutesToTimeString(activity.earnedMinutes)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteActivity(activity)}
                    >
                      <Text style={styles.deleteButtonText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* 카톡 기록 형식 */}
        <View style={styles.formatCard}>
          <View style={styles.formatHeader}>
            <Text style={styles.formatTitle}>💬 카톡 기록 형식</Text>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyKakao}
              activeOpacity={0.7}
            >
              <Text style={styles.copyButtonText}>📋 복사</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.formatContent}>
            <Text style={styles.formatText}>{getKakaoText()}</Text>
          </View>
        </View>

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

  // 날짜 선택 바
  dateBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    alignItems: 'center',
    paddingRight: SPACING.sm,
    ...SHADOWS.small,
  },
  dateScrollContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  dateButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.cardAlt,
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  dateButtonSelected: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.small,
  },
  dateText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  dateTextSelected: {
    color: COLORS.textWhite,
  },
  dateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.earn,
    marginTop: 4,
  },
  dateDotSelected: {
    backgroundColor: COLORS.textWhite,
  },
  calendarButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.goldLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarButtonText: {
    fontSize: 24,
  },
  statsButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs,
  },
  statsButtonText: {
    fontSize: 24,
  },

  // 통계 모달
  statsContainer: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
    ...SHADOWS.large,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.cardAlt,
  },
  statsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  statsClose: {
    fontSize: 24,
    color: COLORS.textSecondary,
    padding: SPACING.xs,
  },
  periodSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  periodButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.cardAlt,
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
  },
  periodButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: COLORS.textWhite,
  },
  periodRange: {
    textAlign: 'center',
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  statCard: {
    width: '47%',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  statCardEarn: {
    backgroundColor: `${COLORS.earn}15`,
  },
  statCardSpend: {
    backgroundColor: `${COLORS.spend}15`,
  },
  statCardPenalty: {
    backgroundColor: `${COLORS.penalty}15`,
  },
  statCardNet: {
    backgroundColor: COLORS.goldLight,
    width: '100%',
  },
  statCardEmoji: {
    fontSize: 24,
    marginBottom: SPACING.xs,
  },
  statCardLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  statCardValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    marginTop: SPACING.xs,
  },
  statsExtra: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statsExtraItem: {
    alignItems: 'center',
  },
  statsExtraLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  statsExtraValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.cardAlt,
    marginHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  customDateButton: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 100,
    alignItems: 'center',
  },
  customDateButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  customDateArrow: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },

  // 달력 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  calendarContainer: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
    ...SHADOWS.large,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.cardAlt,
  },
  calendarTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  calendarClose: {
    fontSize: 24,
    color: COLORS.textSecondary,
    padding: SPACING.xs,
  },
  calendar: {
    borderRadius: BORDER_RADIUS.lg,
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },

  // 선택된 날짜 카드
  selectedDateCard: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  selectedDateText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textWhite,
  },

  contentScroll: {
    flex: 1,
  },

  // 요약 카드
  summaryCard: {
    backgroundColor: COLORS.card,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  summaryTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  summaryItem: {
    width: '48%',
    backgroundColor: COLORS.cardAlt,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  summaryItemHighlight: {
    backgroundColor: COLORS.goldLight,
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
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  summaryValueBig: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.goldDark,
    fontWeight: 'bold',
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
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
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
    fontSize: 22,
  },
  activityInfo: {
    flex: 1,
  },
  activityLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  activityTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  statusApproved: {
    backgroundColor: COLORS.earn,
  },
  statusRejected: {
    backgroundColor: COLORS.penalty,
  },
  statusText: {
    fontSize: 10,
    color: COLORS.textWhite,
    fontWeight: '600',
  },
  activityDescription: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  activityBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  activityBadgeEarn: {
    backgroundColor: `${COLORS.earn}15`,
  },
  activityBadgeSpend: {
    backgroundColor: `${COLORS.spend}15`,
  },
  activityBadgePenalty: {
    backgroundColor: `${COLORS.penalty}15`,
  },
  activityAmount: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
  },
  activityRight: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  deleteButton: {
    padding: SPACING.xs,
  },
  deleteButtonText: {
    fontSize: 16,
  },

  // 카톡 형식 카드
  formatCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  formatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardAlt,
    padding: SPACING.md,
  },
  formatTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  copyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  copyButtonText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  formatContent: {
    backgroundColor: '#FFFEF0',
    padding: SPACING.md,
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.goldLight,
  },
  formatText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
});

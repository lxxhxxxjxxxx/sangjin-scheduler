import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useActivities } from '../../contexts/ActivityContext';
import { useSchedules } from '../../contexts/ScheduleContext';
import { useSubjects } from '../../contexts/SubjectContext';
import {
  EARN_ACTIVITIES,
  SPEND_ACTIVITIES,
  NEUTRAL_ACTIVITIES,
  ActivityConfig,
} from '../../constants/activities';
import { minutesToTimeString, Schedule, DayOfWeek, Subject } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/theme';
import { isHoliday } from '../../utils/holidays';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// 웹 호환 Alert
function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

type TabType = 'earn' | 'spend' | 'neutral';

type DateOption = 'today' | 'yesterday';

export default function RecordScreen() {
  const { addActivity, balance } = useActivities();
  const { schedules } = useSchedules();
  const { subjects } = useSubjects();
  const [activeTab, setActiveTab] = useState<TabType>('earn');
  const [selectedDate, setSelectedDate] = useState<DateOption>('today');
  const [selectedActivity, setSelectedActivity] = useState<ActivityConfig | null>(null);
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [startHour, setStartHour] = useState('');
  const [startMinute, setStartMinute] = useState('');
  const [endHour, setEndHour] = useState('');
  const [endMinute, setEndMinute] = useState('');
  const [description, setDescription] = useState('');

  // 스케줄 관련 상태
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [showScheduleMode, setShowScheduleMode] = useState(false);

  // 과목 선택 상태
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  // 학원/과외 스케줄 필터링 (활성화된 것만)
  const academySchedules = useMemo(() => {
    return schedules.filter(s => s.isActive && s.category === 'academy');
  }, [schedules]);

  // 특정 요일의 날짜 구하기 (이번 주)
  function getDateForDayOfWeek(dayOfWeek: DayOfWeek): Date {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = dayOfWeek - currentDay;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);
    return targetDate;
  }

  // 선택된 날짜 계산
  const targetDate = useMemo(() => {
    const date = new Date();
    if (selectedDate === 'yesterday') {
      date.setDate(date.getDate() - 1);
    }
    return date;
  }, [selectedDate]);

  // 선택된 날짜의 휴일 여부 체크
  const selectedDateHoliday = useMemo(() => {
    return isHoliday(targetDate);
  }, [targetDate]);

  // 날짜 표시 문자열
  const dateLabels = useMemo(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    const getDayName = (d: Date) => ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];

    return {
      today: `오늘 ${formatDate(today)}(${getDayName(today)})`,
      yesterday: `어제 ${formatDate(yesterday)}(${getDayName(yesterday)})`,
    };
  }, []);

  const activities = {
    earn: EARN_ACTIVITIES,
    spend: SPEND_ACTIVITIES,
    neutral: NEUTRAL_ACTIVITIES,
  };

  const tabConfig = {
    earn: { label: '💰 시간 벌기', color: COLORS.earn },
    spend: { label: '🎮 시간 쓰기', color: COLORS.spend },
    neutral: { label: '🎨 기타', color: COLORS.neutral },
  };

  function resetForm() {
    setSelectedActivity(null);
    setHours('');
    setMinutes('');
    setStartHour('');
    setStartMinute('');
    setEndHour('');
    setEndMinute('');
    setDescription('');
    // 스케줄 관련 초기화
    setSelectedSchedule(null);
    setSelectedDays([]);
    setShowScheduleMode(false);
    // 과목 초기화
    setSelectedSubject(null);
    // 날짜는 초기화하지 않음 (사용자 편의)
  }

  function formatTimeString(hour: string, minute: string): string | undefined {
    if (!hour && !minute) return undefined;
    const h = hour.padStart(2, '0');
    const m = (minute || '0').padStart(2, '0');
    return `${h}:${m}`;
  }

  async function handleSubmit() {
    if (!selectedActivity) {
      showAlert('앗!', '활동을 선택해주세요 😊');
      return;
    }

    // 스케줄 모드: 여러 요일 한번에 기록
    if (showScheduleMode && selectedSchedule && selectedDays.length > 0) {
      const recordCount = selectedDays.length;
      const totalMinutes = selectedSchedule.durationMinutes * recordCount;

      for (const dayOfWeek of selectedDays) {
        const dateForDay = getDateForDayOfWeek(dayOfWeek);
        await addActivity({
          date: dateForDay,
          type: 'earn',
          category: 'academy',
          durationMinutes: selectedSchedule.durationMinutes,
          multiplier: selectedSchedule.multiplier,
          earnedMinutes: selectedSchedule.durationMinutes * selectedSchedule.multiplier,
          needsApproval: false,
          status: 'approved',
          description: selectedSchedule.name,
          startTime: selectedSchedule.startTime,
          endTime: selectedSchedule.endTime,
        });
      }

      const dayNames = selectedDays.map(d => DAY_NAMES[d]).join(', ');
      showAlert(
        '🎉 기록 완료!',
        `${selectedSchedule.emoji} ${selectedSchedule.name}\n${dayNames} (${recordCount}일)\n총 ${minutesToTimeString(totalMinutes)} 벌었어요!`
      );

      resetForm();
      return;
    }

    // 일반 모드
    let durationMinutes = selectedActivity.fixedMinutes || 0;

    if (!selectedActivity.fixedMinutes) {
      const h = parseInt(hours) || 0;
      const m = parseInt(minutes) || 0;
      durationMinutes = h * 60 + m;

      if (durationMinutes <= 0) {
        showAlert('앗!', '시간을 입력해주세요 ⏰');
        return;
      }
    }

    if (selectedActivity.type === 'spend') {
      const spendMinutes = durationMinutes * selectedActivity.multiplier;
      if (spendMinutes > balance) {
        showAlert(
          '잔액 부족! 😰',
          `현재 저금: ${minutesToTimeString(balance)}\n사용하려는 시간: ${minutesToTimeString(spendMinutes)}\n\n먼저 시간을 벌어주세요!`
        );
        return;
      }
    }

    const earnedMinutes = Math.round(durationMinutes * selectedActivity.multiplier);

    // 과목이 필요한 활동인데 선택 안 한 경우
    const needsSubject = selectedActivity.category === 'homework' || selectedActivity.category === 'self_study';
    if (needsSubject && !selectedSubject) {
      showAlert('앗!', '과목을 선택해주세요 📚');
      return;
    }

    await addActivity({
      date: targetDate,
      type: selectedActivity.type,
      category: selectedActivity.category,
      subject: selectedSubject?.name,
      durationMinutes,
      multiplier: selectedActivity.multiplier,
      earnedMinutes: selectedActivity.fixedMinutes || earnedMinutes,
      needsApproval: selectedActivity.needsApproval,
      status: selectedActivity.needsApproval ? 'pending' : 'approved',
      description: description || undefined,
      startTime: formatTimeString(startHour, startMinute),
      endTime: formatTimeString(endHour, endMinute),
    });

    const typeText = selectedActivity.type === 'earn' ? '벌었어요!' : '썼어요!';
    const emoji = selectedActivity.type === 'earn' ? '🎉' : '✅';
    const subjectText = selectedSubject ? ` (${selectedSubject.name})` : '';
    showAlert(
      `${emoji} 기록 완료!`,
      `${selectedActivity.emoji} ${selectedActivity.label}${subjectText}\n${minutesToTimeString(earnedMinutes)} ${typeText}`
    );

    resetForm();
  }

  // 스케줄 선택 핸들러
  function handleSelectSchedule(schedule: Schedule) {
    setSelectedSchedule(schedule);
    setSelectedDays([]); // 요일 선택 초기화
    // 시간 자동 입력
    const [sh, sm] = schedule.startTime.split(':');
    const [eh, em] = schedule.endTime.split(':');
    setStartHour(sh);
    setStartMinute(sm);
    setEndHour(eh);
    setEndMinute(em);
    setHours(Math.floor(schedule.durationMinutes / 60).toString());
    setMinutes((schedule.durationMinutes % 60).toString());
  }

  // 요일 토글 핸들러
  function toggleDay(day: DayOfWeek) {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  }

  function handleSelectActivity(activity: ActivityConfig) {
    // 휴일 기본은 휴일에만 선택 가능
    if (activity.category === 'holiday_bonus' && !selectedDateHoliday.isHoliday) {
      const dateText = selectedDate === 'today' ? '오늘' : '어제';
      showAlert(
        `🚫 ${dateText}은 휴일이 아니에요!`,
        '휴일 기본 보너스는 토/일요일 또는 공휴일에만 받을 수 있어요.'
      );
      return;
    }

    // 학원/과외 선택 시 스케줄이 있으면 스케줄 모드 활성화
    if (activity.category === 'academy' && academySchedules.length > 0) {
      setShowScheduleMode(true);
      setSelectedSchedule(null);
      setSelectedDays([]);
    } else {
      setShowScheduleMode(false);
      setSelectedSchedule(null);
      setSelectedDays([]);
    }

    setSelectedActivity(activity);
  }

  function renderActivityButton(activity: ActivityConfig) {
    const isSelected = selectedActivity?.category === activity.category;
    const isHolidayBonus = activity.category === 'holiday_bonus';
    const isDisabled = isHolidayBonus && !selectedDateHoliday.isHoliday;

    return (
      <TouchableOpacity
        key={activity.category}
        style={[
          styles.activityButton,
          isSelected && [styles.activityButtonSelected, { borderColor: tabConfig[activeTab].color }],
          isDisabled && styles.activityButtonDisabled,
        ]}
        onPress={() => handleSelectActivity(activity)}
        activeOpacity={0.7}
      >
        <Text style={[styles.activityEmoji, isDisabled && styles.activityEmojiDisabled]}>
          {activity.emoji}
        </Text>
        <Text style={[
          styles.activityLabel,
          isSelected && { color: tabConfig[activeTab].color },
          isDisabled && styles.activityLabelDisabled,
        ]}>
          {activity.label}
        </Text>
        {isHolidayBonus && !selectedDateHoliday.isHoliday && (
          <Text style={styles.disabledHint}>휴일 아님</Text>
        )}
        {isHolidayBonus && selectedDateHoliday.isHoliday && (
          <Text style={styles.holidayHint}>🎊 {selectedDateHoliday.reason}</Text>
        )}
        <View style={styles.badgeContainer}>
          {activity.multiplier !== 1 && activity.multiplier !== 0 && (
            <View style={[styles.multiplierBadge, { backgroundColor: COLORS.earn }]}>
              <Text style={styles.badgeText}>{activity.multiplier}배</Text>
            </View>
          )}
          {activity.fixedMinutes && (
            <View style={[styles.multiplierBadge, { backgroundColor: COLORS.gold }]}>
              <Text style={styles.badgeText}>{minutesToTimeString(activity.fixedMinutes)}</Text>
            </View>
          )}
          {activity.needsApproval && (
            <View style={[styles.multiplierBadge, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.badgeText}>확인필요</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  const calculatedMinutes = selectedActivity?.fixedMinutes ||
    Math.round(((parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0)) * (selectedActivity?.multiplier || 1));

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 현재 잔액 */}
      <View style={styles.balanceBar}>
        <Text style={styles.balanceLabel}>🐷 현재 저금</Text>
        <Text style={styles.balanceValue}>{minutesToTimeString(balance)}</Text>
      </View>

      {/* 날짜 선택 (스케줄 모드가 아닐 때만) */}
      {!showScheduleMode && (
        <View style={styles.dateSelector}>
          <Text style={styles.dateSelectorLabel}>📅 기록할 날짜</Text>
          <View style={styles.dateButtons}>
            <TouchableOpacity
              style={[
                styles.dateButton,
                selectedDate === 'today' && styles.dateButtonSelected,
              ]}
              onPress={() => {
                setSelectedDate('today');
                if (selectedActivity?.category === 'holiday_bonus') {
                  setSelectedActivity(null);
                }
              }}
            >
              <Text style={[
                styles.dateButtonText,
                selectedDate === 'today' && styles.dateButtonTextSelected,
              ]}>
                {dateLabels.today}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dateButton,
                selectedDate === 'yesterday' && styles.dateButtonSelected,
              ]}
              onPress={() => {
                setSelectedDate('yesterday');
                if (selectedActivity?.category === 'holiday_bonus') {
                  setSelectedActivity(null);
                }
              }}
            >
              <Text style={[
                styles.dateButtonText,
                selectedDate === 'yesterday' && styles.dateButtonTextSelected,
              ]}>
                {dateLabels.yesterday}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 탭 */}
      <View style={styles.tabContainer}>
        {(Object.keys(tabConfig) as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && [styles.tabActive, { backgroundColor: tabConfig[tab].color }],
            ]}
            onPress={() => {
              setActiveTab(tab);
              resetForm();
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tabConfig[tab].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 활동 선택 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✨ 활동 선택</Text>
        <View style={styles.activityGrid}>
          {activities[activeTab].map(renderActivityButton)}
        </View>
      </View>

      {/* 스케줄 선택 (학원/과외 선택 시) */}
      {showScheduleMode && selectedActivity?.category === 'academy' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📚 등록된 스케줄</Text>
          <View style={styles.scheduleList}>
            {academySchedules.map((schedule) => {
              const isSelected = selectedSchedule?.id === schedule.id;
              const dayLabels = schedule.daysOfWeek.map(d => DAY_NAMES[d]).join(', ');
              return (
                <TouchableOpacity
                  key={schedule.id}
                  style={[
                    styles.scheduleItem,
                    isSelected && styles.scheduleItemSelected,
                  ]}
                  onPress={() => handleSelectSchedule(schedule)}
                >
                  <Text style={styles.scheduleEmoji}>{schedule.emoji}</Text>
                  <View style={styles.scheduleInfo}>
                    <Text style={[
                      styles.scheduleName,
                      isSelected && styles.scheduleNameSelected,
                    ]}>
                      {schedule.name}
                    </Text>
                    <Text style={styles.scheduleTime}>
                      {schedule.startTime} ~ {schedule.endTime} ({minutesToTimeString(schedule.durationMinutes)})
                    </Text>
                    <Text style={styles.scheduleDays}>매주 {dayLabels}</Text>
                  </View>
                  {isSelected && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 스케줄 없이 직접 입력 옵션 */}
          <TouchableOpacity
            style={[
              styles.manualInputButton,
              !selectedSchedule && selectedActivity && styles.manualInputButtonSelected,
            ]}
            onPress={() => {
              setSelectedSchedule(null);
              setSelectedDays([]);
              setShowScheduleMode(false);
            }}
          >
            <Text style={styles.manualInputText}>✏️ 스케줄 없이 직접 입력</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 요일 선택 (스케줄 선택 후) */}
      {showScheduleMode && selectedSchedule && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📆 기록할 요일 선택</Text>
          <Text style={styles.sectionSubtitle}>여러 요일을 선택하면 한번에 기록돼요!</Text>
          <View style={styles.dayGrid}>
            {selectedSchedule.daysOfWeek.map((day) => {
              const isSelected = selectedDays.includes(day);
              const dateForDay = getDateForDayOfWeek(day);
              const dateStr = `${dateForDay.getMonth() + 1}/${dateForDay.getDate()}`;
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayButton,
                    isSelected && styles.dayButtonSelected,
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[
                    styles.dayButtonText,
                    isSelected && styles.dayButtonTextSelected,
                  ]}>
                    {DAY_NAMES[day]}
                  </Text>
                  <Text style={[
                    styles.dayButtonDate,
                    isSelected && styles.dayButtonDateSelected,
                  ]}>
                    {dateStr}
                  </Text>
                  {isSelected && <Text style={styles.dayCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedDays.length > 0 && (
            <View style={styles.selectedDaysSummary}>
              <Text style={styles.selectedDaysText}>
                선택: {selectedDays.map(d => DAY_NAMES[d]).join(', ')} ({selectedDays.length}일)
              </Text>
              <Text style={styles.selectedDaysTotal}>
                총 {minutesToTimeString(selectedSchedule.durationMinutes * selectedDays.length)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 과목 선택 (숙제, 스스로 공부 선택 시) */}
      {selectedActivity && (selectedActivity.category === 'homework' || selectedActivity.category === 'self_study') && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📚 과목 선택</Text>
          <View style={styles.subjectGrid}>
            {subjects.map((subject) => {
              const isSelected = selectedSubject?.id === subject.id;
              return (
                <TouchableOpacity
                  key={subject.id}
                  style={[
                    styles.subjectButton,
                    isSelected && styles.subjectButtonSelected,
                  ]}
                  onPress={() => setSelectedSubject(subject)}
                >
                  <Text style={styles.subjectEmoji}>{subject.emoji}</Text>
                  <Text style={[
                    styles.subjectName,
                    isSelected && styles.subjectNameSelected,
                  ]}>
                    {subject.name}
                  </Text>
                  {isSelected && <Text style={styles.subjectCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* 시간 입력 (스케줄 모드가 아닐 때만) */}
      {selectedActivity && !selectedActivity.fixedMinutes && !showScheduleMode && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏰ 시간 입력</Text>
          <View style={styles.timeInputContainer}>
            <View style={styles.timeInputGroup}>
              <TextInput
                style={styles.timeInput}
                value={hours}
                onChangeText={setHours}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={COLORS.textLight}
                maxLength={2}
              />
              <Text style={styles.timeLabel}>시간</Text>
            </View>
            <Text style={styles.timeSeparator}>:</Text>
            <View style={styles.timeInputGroup}>
              <TextInput
                style={styles.timeInput}
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={COLORS.textLight}
                maxLength={2}
              />
              <Text style={styles.timeLabel}>분</Text>
            </View>
          </View>

          <View style={styles.periodContainer}>
            <View style={styles.periodGroup}>
              <Text style={styles.periodLabel}>시작 시간</Text>
              <View style={styles.periodInputRow}>
                <TextInput
                  style={styles.periodInput}
                  value={startHour}
                  onChangeText={setStartHour}
                  placeholder="14"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.periodColon}>:</Text>
                <TextInput
                  style={styles.periodInput}
                  value={startMinute}
                  onChangeText={setStartMinute}
                  placeholder="00"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>
            <Text style={styles.periodArrow}>→</Text>
            <View style={styles.periodGroup}>
              <Text style={styles.periodLabel}>종료 시간</Text>
              <View style={styles.periodInputRow}>
                <TextInput
                  style={styles.periodInput}
                  value={endHour}
                  onChangeText={setEndHour}
                  placeholder="16"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.periodColon}>:</Text>
                <TextInput
                  style={styles.periodInput}
                  value={endMinute}
                  onChangeText={setEndMinute}
                  placeholder="00"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 메모 (스케줄 모드가 아닐 때만) */}
      {selectedActivity && !showScheduleMode && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 메모 (선택)</Text>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={setDescription}
            placeholder="무엇을 했는지 적어보세요..."
            placeholderTextColor={COLORS.textLight}
            multiline
          />
        </View>
      )}

      {/* 미리보기 - 일반 모드 */}
      {selectedActivity && !showScheduleMode && (
        <View style={[styles.previewCard, { borderColor: tabConfig[activeTab].color }]}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewEmoji}>{selectedActivity.emoji}</Text>
            <Text style={styles.previewTitle}>{selectedActivity.label}</Text>
          </View>

          {!selectedActivity.fixedMinutes && selectedActivity.multiplier !== 1 && (
            <View style={styles.previewCalc}>
              <Text style={styles.previewCalcText}>
                {minutesToTimeString((parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0))} × {selectedActivity.multiplier}배
              </Text>
            </View>
          )}

          <View style={[styles.previewResult, { backgroundColor: `${tabConfig[activeTab].color}15` }]}>
            <Text style={styles.previewResultLabel}>
              {selectedActivity.type === 'earn' ? '벌 시간' : '쓸 시간'}
            </Text>
            <Text style={[styles.previewResultValue, { color: tabConfig[activeTab].color }]}>
              {selectedActivity.type === 'earn' ? '+' : '-'}{minutesToTimeString(calculatedMinutes)}
            </Text>
          </View>

          {selectedActivity.needsApproval && (
            <View style={styles.approvalNote}>
              <Text style={styles.approvalNoteText}>👨‍👩‍👧 부모님 확인이 필요해요</Text>
            </View>
          )}
        </View>
      )}

      {/* 미리보기 - 스케줄 모드 */}
      {showScheduleMode && selectedSchedule && selectedDays.length > 0 && (
        <View style={[styles.previewCard, { borderColor: COLORS.earn }]}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewEmoji}>{selectedSchedule.emoji}</Text>
            <Text style={styles.previewTitle}>{selectedSchedule.name}</Text>
          </View>

          <View style={styles.previewCalc}>
            <Text style={styles.previewCalcText}>
              {selectedDays.map(d => DAY_NAMES[d]).join(', ')} ({selectedDays.length}일)
            </Text>
          </View>

          <View style={[styles.previewResult, { backgroundColor: `${COLORS.earn}15` }]}>
            <Text style={styles.previewResultLabel}>총 벌 시간</Text>
            <Text style={[styles.previewResultValue, { color: COLORS.earn }]}>
              +{minutesToTimeString(selectedSchedule.durationMinutes * selectedDays.length)}
            </Text>
          </View>
        </View>
      )}

      {/* 제출 버튼 - 일반 모드 */}
      {selectedActivity && !showScheduleMode && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: tabConfig[activeTab].color }]}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.submitButtonText}>
            {selectedActivity.type === 'earn' ? '💰 시간 벌기!' : '🎮 시간 쓰기!'}
          </Text>
        </TouchableOpacity>
      )}

      {/* 제출 버튼 - 스케줄 모드 */}
      {showScheduleMode && selectedSchedule && selectedDays.length > 0 && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: COLORS.earn }]}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.submitButtonText}>
            📚 {selectedDays.length}일치 한번에 기록하기!
          </Text>
        </TouchableOpacity>
      )}

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // 잔액 바
  balanceBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.goldLight,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  balanceLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.goldDark,
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.goldDark,
    fontWeight: 'bold',
  },

  // 날짜 선택
  dateSelector: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.small,
  },
  dateSelectorLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  dateButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  dateButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.cardAlt,
    alignItems: 'center',
  },
  dateButtonSelected: {
    backgroundColor: COLORS.primary,
  },
  dateButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  dateButtonTextSelected: {
    color: COLORS.textWhite,
  },

  // 탭
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    margin: SPACING.md,
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.small,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  tabActive: {
    ...SHADOWS.small,
  },
  tabText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.textWhite,
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
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    marginTop: -SPACING.sm,
  },

  // 스케줄 선택
  scheduleList: {
    gap: SPACING.sm,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  scheduleItemSelected: {
    borderColor: COLORS.earn,
    backgroundColor: `${COLORS.earn}10`,
  },
  scheduleEmoji: {
    fontSize: 32,
    marginRight: SPACING.md,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  scheduleNameSelected: {
    color: COLORS.earn,
  },
  scheduleTime: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  scheduleDays: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  checkMark: {
    fontSize: 24,
    color: COLORS.earn,
    fontWeight: 'bold',
  },
  manualInputButton: {
    padding: SPACING.md,
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  manualInputButtonSelected: {
    borderColor: COLORS.primary,
  },
  manualInputText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },

  // 과목 선택
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  subjectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: SPACING.sm,
  },
  subjectButtonSelected: {
    borderColor: COLORS.earn,
    backgroundColor: `${COLORS.earn}15`,
  },
  subjectEmoji: {
    fontSize: 24,
  },
  subjectName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  subjectNameSelected: {
    color: COLORS.earn,
  },
  subjectCheck: {
    fontSize: 18,
    color: COLORS.earn,
    fontWeight: 'bold',
    marginLeft: SPACING.xs,
  },

  // 요일 선택
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  dayButton: {
    minWidth: 70,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayButtonSelected: {
    borderColor: COLORS.earn,
    backgroundColor: `${COLORS.earn}15`,
  },
  dayButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  dayButtonTextSelected: {
    color: COLORS.earn,
  },
  dayButtonDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dayButtonDateSelected: {
    color: COLORS.earn,
  },
  dayCheck: {
    fontSize: 16,
    color: COLORS.earn,
    fontWeight: 'bold',
    marginTop: 2,
  },
  selectedDaysSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: `${COLORS.earn}15`,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.md,
  },
  selectedDaysText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
  },
  selectedDaysTotal: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.earn,
  },

  // 활동 그리드
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  activityButton: {
    backgroundColor: COLORS.cardAlt,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    minWidth: '47%',
    flexGrow: 1,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activityButtonSelected: {
    backgroundColor: COLORS.card,
    borderWidth: 2,
  },
  activityButtonDisabled: {
    opacity: 0.5,
    backgroundColor: COLORS.cardAlt,
  },
  activityEmoji: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  activityEmojiDisabled: {
    opacity: 0.5,
  },
  activityLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontWeight: '600',
  },
  activityLabelDisabled: {
    color: COLORS.textLight,
  },
  disabledHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  holidayHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.earn,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },
  multiplierBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  badgeText: {
    color: COLORS.textWhite,
    fontSize: 10,
    fontWeight: 'bold',
  },

  // 시간 입력
  timeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timeInputGroup: {
    alignItems: 'center',
  },
  timeInput: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 80,
    color: COLORS.textPrimary,
  },
  timeLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  timeSeparator: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  periodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  periodGroup: {
    alignItems: 'center',
  },
  periodLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  periodInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodInput: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    textAlign: 'center',
    width: 50,
    color: COLORS.textPrimary,
  },
  periodColon: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginHorizontal: 4,
  },
  periodArrow: {
    fontSize: 24,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },

  // 메모
  descriptionInput: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    minHeight: 80,
    textAlignVertical: 'top',
    color: COLORS.textPrimary,
  },

  // 미리보기
  previewCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 2,
    ...SHADOWS.medium,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  previewEmoji: {
    fontSize: 36,
    marginRight: SPACING.md,
  },
  previewTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  previewCalc: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  previewCalcText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  previewResult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  previewResultLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  previewResultValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
  },
  approvalNote: {
    alignItems: 'center',
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.goldLight,
    borderRadius: BORDER_RADIUS.md,
  },
  approvalNoteText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.goldDark,
    fontWeight: '600',
  },

  // 제출 버튼
  submitButton: {
    marginHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  submitButtonText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
});

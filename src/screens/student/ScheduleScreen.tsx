import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
} from 'react-native';

// 웹 호환 Alert
function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

// 웹 호환 Confirm
function showConfirm(title: string, message: string, onConfirm: () => void, confirmText = '확인', cancelText = '취소') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel' },
      { text: confirmText, onPress: onConfirm },
    ]);
  }
}
import { useSchedules } from '../../contexts/ScheduleContext';
import { useAuth } from '../../contexts/AuthContext';
import { Schedule, DayOfWeek, DAY_NAMES, minutesToTimeString } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/theme';

const EMOJI_OPTIONS = ['📚', '✏️', '🎹', '🎨', '⚽', '🏊', '🥋', '💻', '🇬🇧', '🧮'];

export default function ScheduleScreen() {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const {
    schedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
  } = useSchedules();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // 폼 상태
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📚');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [startHour, setStartHour] = useState('');
  const [startMinute, setStartMinute] = useState('');
  const [endHour, setEndHour] = useState('');
  const [endMinute, setEndMinute] = useState('');

  function resetForm() {
    setName('');
    setEmoji('📚');
    setSelectedDays([]);
    setStartHour('');
    setStartMinute('');
    setEndHour('');
    setEndMinute('');
    setEditingSchedule(null);
  }

  function openAddModal() {
    resetForm();
    setModalVisible(true);
  }

  function openEditModal(schedule: Schedule) {
    setEditingSchedule(schedule);
    setName(schedule.name);
    setEmoji(schedule.emoji);
    setSelectedDays([...schedule.daysOfWeek]);

    const [sh, sm] = schedule.startTime.split(':');
    const [eh, em] = schedule.endTime.split(':');
    setStartHour(sh);
    setStartMinute(sm);
    setEndHour(eh);
    setEndMinute(em);

    setModalVisible(true);
  }

  function toggleDay(day: DayOfWeek) {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day].sort((a, b) => a - b));
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      showAlert('앗!', '이름을 입력해주세요');
      return;
    }
    if (selectedDays.length === 0) {
      showAlert('앗!', '요일을 선택해주세요');
      return;
    }
    if (!startHour || !endHour) {
      showAlert('앗!', '시간을 입력해주세요');
      return;
    }

    const startTime = `${startHour.padStart(2, '0')}:${(startMinute || '0').padStart(2, '0')}`;
    const endTime = `${endHour.padStart(2, '0')}:${(endMinute || '0').padStart(2, '0')}`;

    // 시간 계산
    const startMins = parseInt(startHour) * 60 + parseInt(startMinute || '0');
    const endMins = parseInt(endHour) * 60 + parseInt(endMinute || '0');
    const durationMinutes = endMins - startMins;

    if (durationMinutes <= 0) {
      showAlert('앗!', '종료 시간이 시작 시간보다 커야 해요');
      return;
    }

    const scheduleData = {
      name: name.trim(),
      emoji,
      category: 'academy' as const,
      daysOfWeek: selectedDays,
      startTime,
      endTime,
      durationMinutes,
      multiplier: 1,
      isActive: true,
    };

    const confirmMessage = editingSchedule
      ? `${emoji} ${name} 스케줄을 수정할까요?`
      : `${emoji} ${name} 스케줄을 추가할까요?`;

    showConfirm(
      editingSchedule ? '스케줄 수정' : '스케줄 추가',
      confirmMessage,
      async () => {
        if (editingSchedule) {
          await updateSchedule(editingSchedule.id, scheduleData);
          showAlert('✅ 수정 완료!', `${emoji} ${name} 스케줄이 수정되었어요`);
        } else {
          await addSchedule(scheduleData);
          showAlert('✅ 추가 완료!', `${emoji} ${name} 스케줄이 추가되었어요`);
        }
        setModalVisible(false);
        resetForm();
      },
      editingSchedule ? '수정' : '추가'
    );
  }

  async function handleDelete(schedule: Schedule) {
    showConfirm(
      '스케줄 삭제',
      `${schedule.emoji} ${schedule.name}을(를) 삭제할까요?`,
      async () => {
        await deleteSchedule(schedule.id);
        showAlert('삭제 완료', '스케줄이 삭제되었어요');
      },
      '삭제'
    );
  }

  function getDaysText(days: DayOfWeek[]): string {
    if (days.length === 7) return '매일';
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return '평일';
    if (days.length === 2 && days.includes(0) && days.includes(6)) return '주말';
    return days.map(d => DAY_NAMES[d]).join(', ');
  }

  // 요일순으로 정렬된 스케줄
  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => {
      // 첫 번째 요일 기준 정렬 (월요일부터 시작)
      const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // 월화수목금토일
      const aFirstDay = Math.min(...a.daysOfWeek.map(d => dayOrder.indexOf(d)));
      const bFirstDay = Math.min(...b.daysOfWeek.map(d => dayOrder.indexOf(d)));
      if (aFirstDay !== bFirstDay) return aFirstDay - bFirstDay;
      // 같은 요일이면 시작 시간순
      return a.startTime.localeCompare(b.startTime);
    });
  }, [schedules]);

  // 요일별 스케줄 그룹
  const schedulesByDay = useMemo(() => {
    const days: { [key: number]: typeof schedules } = {
      1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: []
    };
    schedules.forEach(schedule => {
      schedule.daysOfWeek.forEach(day => {
        days[day].push(schedule);
      });
    });
    // 각 요일별로 시간순 정렬
    Object.keys(days).forEach(key => {
      days[Number(key)].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return days;
  }, [schedules]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 주간 요약 */}
        {schedules.length > 0 && (
          <View style={styles.weekSummary}>
            <Text style={styles.weekSummaryTitle}>🗓️ 주간 스케줄</Text>
            <View style={styles.weekGrid}>
              {([1, 2, 3, 4, 5, 6, 0] as DayOfWeek[]).map(day => {
                const daySchedules = schedulesByDay[day];
                const isWeekend = day === 0 || day === 6;
                return (
                  <View key={day} style={[styles.weekDay, isWeekend && styles.weekDayWeekend]}>
                    <Text style={[styles.weekDayLabel, isWeekend && styles.weekDayLabelWeekend]}>
                      {DAY_NAMES[day]}
                    </Text>
                    <View style={styles.weekDaySchedules}>
                      {daySchedules.length === 0 ? (
                        <Text style={styles.weekDayEmpty}>-</Text>
                      ) : (
                        daySchedules.map((schedule, idx) => (
                          <View key={`${schedule.id}-${idx}`} style={styles.weekScheduleItem}>
                            <Text style={styles.weekScheduleEmoji}>{schedule.emoji}</Text>
                            <Text style={styles.weekScheduleTime} numberOfLines={1}>
                              {schedule.startTime.slice(0, 5)} ({minutesToTimeString(schedule.durationMinutes)})
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 안내 */}
        {schedules.length === 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoEmoji}>💡</Text>
            <Text style={styles.infoText}>
              {isParent
                ? '학원이나 과외 스케줄을 미리 등록해두면\n홈 화면에서 바로 기록할 수 있어요!'
                : '부모님이 스케줄을 등록해주시면\n홈 화면에서 바로 기록할 수 있어요!'}
            </Text>
          </View>
        )}

        {/* 스케줄 목록 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 {isParent ? '자녀' : '내'} 스케줄</Text>
            {isParent && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={openAddModal}
              >
                <Text style={styles.addButtonText}>+ 추가</Text>
              </TouchableOpacity>
            )}
          </View>

          {sortedSchedules.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>등록된 스케줄이 없어요</Text>
              <Text style={styles.emptySubtext}>
                {isParent
                  ? '+ 추가 버튼을 눌러 학원이나 과외를 등록해보세요'
                  : '부모님이 스케줄을 등록해주실 거예요'}
              </Text>
            </View>
          ) : (
            sortedSchedules.map(schedule => (
              <TouchableOpacity
                key={schedule.id}
                style={styles.scheduleCard}
                onPress={() => isParent && openEditModal(schedule)}
                activeOpacity={isParent ? 0.7 : 1}
                disabled={!isParent}
              >
                <View style={styles.scheduleMain}>
                  <Text style={styles.scheduleEmoji}>{schedule.emoji}</Text>
                  <View style={styles.scheduleInfo}>
                    <Text style={styles.scheduleName}>{schedule.name}</Text>
                    <Text style={styles.scheduleTime}>
                      {schedule.startTime} - {schedule.endTime} ({minutesToTimeString(schedule.durationMinutes)})
                    </Text>
                    <View style={styles.scheduleDays}>
                      {([1, 2, 3, 4, 5, 6, 0] as DayOfWeek[]).map(day => (
                        <View
                          key={day}
                          style={[
                            styles.dayDot,
                            schedule.daysOfWeek.includes(day) && styles.dayDotActive,
                          ]}
                        >
                          <Text style={[
                            styles.dayDotText,
                            schedule.daysOfWeek.includes(day) && styles.dayDotTextActive,
                          ]}>
                            {DAY_NAMES[day]}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
                {isParent && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(schedule)}
                  >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {/* 추가/수정 모달 */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingSchedule ? '스케줄 수정' : '새 스케줄'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.modalSave}>저장</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* 이름 */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>이름</Text>
              <TextInput
                style={styles.formInput}
                value={name}
                onChangeText={setName}
                placeholder="예: 수학학원, 영어과외"
                placeholderTextColor={COLORS.textLight}
              />
            </View>

            {/* 이모지 선택 */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>아이콘</Text>
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[
                      styles.emojiOption,
                      emoji === e && styles.emojiOptionSelected,
                    ]}
                    onPress={() => setEmoji(e)}
                  >
                    <Text style={styles.emojiText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 요일 선택 */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>요일</Text>
              <View style={styles.daysGrid}>
                {([1, 2, 3, 4, 5, 6, 0] as DayOfWeek[]).map(day => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      selectedDays.includes(day) && styles.dayButtonSelected,
                      (day === 0 || day === 6) && styles.dayButtonWeekend,
                      selectedDays.includes(day) && (day === 0 || day === 6) && styles.dayButtonWeekendSelected,
                    ]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      selectedDays.includes(day) && styles.dayButtonTextSelected,
                    ]}>
                      {DAY_NAMES[day]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 시간 입력 */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>시간</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeGroup}>
                  <Text style={styles.timeGroupLabel}>시작</Text>
                  <View style={styles.timeInputRow}>
                    <TextInput
                      style={styles.timeInput}
                      value={startHour}
                      onChangeText={setStartHour}
                      placeholder="14"
                      placeholderTextColor={COLORS.textLight}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={styles.timeColon}>:</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={startMinute}
                      onChangeText={setStartMinute}
                      placeholder="00"
                      placeholderTextColor={COLORS.textLight}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>
                <Text style={styles.timeArrow}>→</Text>
                <View style={styles.timeGroup}>
                  <Text style={styles.timeGroupLabel}>종료</Text>
                  <View style={styles.timeInputRow}>
                    <TextInput
                      style={styles.timeInput}
                      value={endHour}
                      onChangeText={setEndHour}
                      placeholder="16"
                      placeholderTextColor={COLORS.textLight}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={styles.timeColon}>:</Text>
                    <TextInput
                      style={styles.timeInput}
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
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // 안내
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldLight,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  infoEmoji: {
    fontSize: 28,
    marginRight: SPACING.md,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.goldDark,
    lineHeight: 20,
  },

  // 주간 요약
  weekSummary: {
    backgroundColor: COLORS.card,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  weekSummaryTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginHorizontal: 2,
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
  },
  weekDayWeekend: {
    backgroundColor: `${COLORS.spend}10`,
  },
  weekDayLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  weekDayLabelWeekend: {
    color: COLORS.spend,
  },
  weekDaySchedules: {
    alignItems: 'center',
    minHeight: 40,
  },
  weekDayEmpty: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
  },
  weekScheduleItem: {
    alignItems: 'center',
    marginBottom: 4,
  },
  weekScheduleEmoji: {
    fontSize: 16,
  },
  weekScheduleTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },

  // 섹션
  section: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  addButtonText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },

  // 빈 상태
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    textAlign: 'center',
  },

  // 스케줄 카드
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardAlt,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  scheduleMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleEmoji: {
    fontSize: 36,
    marginRight: SPACING.md,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  scheduleTime: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  scheduleDays: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
    gap: 4,
  },
  dayDot: {
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayDotActive: {
    backgroundColor: COLORS.primary,
  },
  dayDotText: {
    fontSize: 10,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  dayDotTextActive: {
    color: COLORS.textWhite,
  },
  deleteButton: {
    padding: SPACING.sm,
  },
  deleteButtonText: {
    fontSize: 20,
  },

  // 모달
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCancel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  modalSave: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalContent: {
    padding: SPACING.lg,
  },

  // 폼
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  formInput: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    ...SHADOWS.small,
  },

  // 이모지 그리드
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  emojiOption: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  emojiOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  emojiText: {
    fontSize: 28,
  },

  // 요일 선택
  daysGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  dayButton: {
    flex: 1,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  dayButtonSelected: {
    backgroundColor: COLORS.primary,
  },
  dayButtonWeekend: {
    backgroundColor: COLORS.cardAlt,
  },
  dayButtonWeekendSelected: {
    backgroundColor: COLORS.spend,
  },
  dayButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  dayButtonTextSelected: {
    color: COLORS.textWhite,
  },

  // 시간 입력
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  timeGroup: {
    alignItems: 'center',
  },
  timeGroupLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    width: 50,
    height: 50,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.textPrimary,
    ...SHADOWS.small,
  },
  timeColon: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginHorizontal: 4,
  },
  timeArrow: {
    fontSize: 24,
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
  },
});

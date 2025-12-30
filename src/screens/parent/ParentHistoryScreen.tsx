import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  TextInput,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
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

export default function ParentHistoryScreen() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [balance, setBalance] = useState(0);

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [showCalendar, setShowCalendar] = useState(false);

  // 수정 모달 상태
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editMinutes, setEditMinutes] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartHour, setEditStartHour] = useState('');
  const [editStartMinute, setEditStartMinute] = useState('');
  const [editEndHour, setEditEndHour] = useState('');
  const [editEndMinute, setEditEndMinute] = useState('');

  // 학생 ID 찾기
  useEffect(() => {
    if (!user?.linkedFamilyCode) return;

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('familyCode', '==', user.linkedFamilyCode));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const studentDoc = snapshot.docs[0];
        setStudentId(studentDoc.id);
        setStudentName(studentDoc.data().name || '학생');
      }
    });

    return () => unsubscribe();
  }, [user?.linkedFamilyCode]);

  // 학생 활동 구독
  useEffect(() => {
    if (!studentId) return;

    const activitiesRef = collection(db, 'activities');
    const q = query(
      activitiesRef,
      where('userId', '==', studentId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedActivities: Activity[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
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
      setActivities(loadedActivities);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentId]);

  // 학생 잔액 구독
  useEffect(() => {
    if (!studentId) return;

    const balanceRef = doc(db, 'balances', studentId);
    const unsubscribe = onSnapshot(balanceRef, (docSnap) => {
      if (docSnap.exists()) {
        setBalance(docSnap.data().currentBalance || 0);
      }
    });

    return () => unsubscribe();
  }, [studentId]);

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

  // 날짜별 활동 그룹
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

  // 선택된 날짜의 활동
  const selectedDateActivities = useMemo(() => {
    return dateGroups[selectedDate] || [];
  }, [dateGroups, selectedDate]);

  // 선택된 날짜 요약
  const summary = useMemo(() => {
    let earnedMinutes = 0;
    let spentMinutes = 0;
    let penaltyMinutes = 0;

    selectedDateActivities.forEach(a => {
      if (a.status === 'approved' || !a.needsApproval) {
        if (a.type === 'earn') earnedMinutes += a.earnedMinutes;
        else if (a.type === 'spend') spentMinutes += a.earnedMinutes;
        else if (a.type === 'penalty') penaltyMinutes += a.earnedMinutes;
      }
    });

    return { earnedMinutes, spentMinutes, penaltyMinutes };
  }, [selectedDateActivities]);

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

  // 활동 수정 시작
  function handleEditActivity(activity: Activity) {
    setEditingActivity(activity);
    setEditHours(Math.floor(activity.durationMinutes / 60).toString());
    setEditMinutes((activity.durationMinutes % 60).toString());
    setEditDescription(activity.description || '');

    if (activity.startTime) {
      const [sh, sm] = activity.startTime.split(':');
      setEditStartHour(sh);
      setEditStartMinute(sm);
    } else {
      setEditStartHour('');
      setEditStartMinute('');
    }

    if (activity.endTime) {
      const [eh, em] = activity.endTime.split(':');
      setEditEndHour(eh);
      setEditEndMinute(em);
    } else {
      setEditEndHour('');
      setEditEndMinute('');
    }

    setEditModalVisible(true);
  }

  // 활동 수정 저장
  async function handleSaveEdit() {
    if (!editingActivity || !studentId) return;

    const newDurationMinutes = (parseInt(editHours) || 0) * 60 + (parseInt(editMinutes) || 0);
    if (newDurationMinutes <= 0) {
      showAlert('오류', '시간을 입력해주세요');
      return;
    }

    const config = getActivityConfig(editingActivity.category);
    const multiplier = config?.multiplier || editingActivity.multiplier;
    const newEarnedMinutes = Math.round(newDurationMinutes * multiplier);

    const oldEarnedMinutes = editingActivity.earnedMinutes;
    const diff = newEarnedMinutes - oldEarnedMinutes;

    try {
      // 활동 업데이트
      const activityRef = doc(db, 'activities', editingActivity.id);
      await updateDoc(activityRef, {
        durationMinutes: newDurationMinutes,
        earnedMinutes: newEarnedMinutes,
        description: editDescription || null,
        startTime: editStartHour ? `${editStartHour.padStart(2, '0')}:${(editStartMinute || '0').padStart(2, '0')}` : null,
        endTime: editEndHour ? `${editEndHour.padStart(2, '0')}:${(editEndMinute || '0').padStart(2, '0')}` : null,
      });

      // 잔액 업데이트 (승인된 활동만)
      if (editingActivity.status === 'approved' || !editingActivity.needsApproval) {
        const balanceRef = doc(db, 'balances', studentId);
        const balanceDoc = await getDoc(balanceRef);
        const currentBalance = balanceDoc.exists() ? balanceDoc.data().currentBalance || 0 : 0;

        let newBalance = currentBalance;
        if (editingActivity.type === 'earn') {
          newBalance += diff;
        } else if (editingActivity.type === 'spend' || editingActivity.type === 'penalty') {
          newBalance -= diff;
        }

        await setDoc(balanceRef, {
          currentBalance: newBalance,
          lastUpdated: new Date(),
        }, { merge: true });
      }

      showAlert('수정 완료', '활동이 수정되었어요');
      setEditModalVisible(false);
      setEditingActivity(null);
    } catch (error) {
      console.error('Edit error:', error);
      showAlert('오류', '수정에 실패했어요');
    }
  }

  // 활동 삭제
  async function handleDeleteActivity(activity: Activity) {
    if (!studentId) return;

    const config = getActivityConfig(activity.category);
    showConfirm(
      '삭제할까요?',
      `"${config?.label || activity.category}" 기록을 삭제하면 시간도 되돌아가요.`,
      async () => {
        try {
          // 활동 삭제
          await deleteDoc(doc(db, 'activities', activity.id));

          // 잔액 업데이트 (승인된 활동만)
          if (activity.status === 'approved' || !activity.needsApproval) {
            const balanceRef = doc(db, 'balances', studentId);
            const balanceDoc = await getDoc(balanceRef);
            const currentBalance = balanceDoc.exists() ? balanceDoc.data().currentBalance || 0 : 0;

            let newBalance = currentBalance;
            if (activity.type === 'earn') {
              newBalance -= activity.earnedMinutes;
            } else if (activity.type === 'spend' || activity.type === 'penalty') {
              newBalance += activity.earnedMinutes;
            }

            await setDoc(balanceRef, {
              currentBalance: newBalance,
              lastUpdated: new Date(),
            }, { merge: true });
          }

          showAlert('삭제 완료', '기록이 삭제되었어요');
        } catch (error) {
          console.error('Delete error:', error);
          showAlert('오류', '삭제에 실패했어요');
        }
      }
    );
  }

  if (!user?.linkedFamilyCode) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🔗</Text>
          <Text style={styles.emptyText}>연결된 학생이 없어요</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>⏳</Text>
          <Text style={styles.emptyText}>불러오는 중...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 학생 정보 바 */}
      <View style={styles.studentBar}>
        <Text style={styles.studentName}>{studentName}의 기록</Text>
        <View style={styles.balanceChip}>
          <Text style={styles.balanceChipText}>🐷 {minutesToTimeString(balance)}</Text>
        </View>
      </View>

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

        <TouchableOpacity
          style={styles.calendarButton}
          onPress={() => setShowCalendar(true)}
        >
          <Text style={styles.calendarButtonText}>📅</Text>
        </TouchableOpacity>
      </View>

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
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 수정 모달 */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        >
          <View style={styles.editContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>✏️ 활동 수정</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.editClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {editingActivity && (
              <View style={styles.editContent}>
                <View style={styles.editActivityInfo}>
                  <Text style={styles.editActivityEmoji}>
                    {getActivityConfig(editingActivity.category)?.emoji || '📝'}
                  </Text>
                  <Text style={styles.editActivityLabel}>
                    {getActivityConfig(editingActivity.category)?.label || editingActivity.category}
                  </Text>
                </View>

                {/* 시간 입력 */}
                <Text style={styles.editSectionTitle}>⏰ 활동 시간</Text>
                <View style={styles.timeInputRow}>
                  <TextInput
                    style={styles.timeInput}
                    value={editHours}
                    onChangeText={setEditHours}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={COLORS.textLight}
                    maxLength={2}
                  />
                  <Text style={styles.timeLabel}>시간</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={editMinutes}
                    onChangeText={setEditMinutes}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={COLORS.textLight}
                    maxLength={2}
                  />
                  <Text style={styles.timeLabel}>분</Text>
                </View>

                {/* 시작/종료 시간 */}
                <Text style={styles.editSectionTitle}>🕐 시작/종료 시간</Text>
                <View style={styles.periodRow}>
                  <View style={styles.periodGroup}>
                    <TextInput
                      style={styles.periodInput}
                      value={editStartHour}
                      onChangeText={setEditStartHour}
                      placeholder="14"
                      placeholderTextColor={COLORS.textLight}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={styles.periodColon}>:</Text>
                    <TextInput
                      style={styles.periodInput}
                      value={editStartMinute}
                      onChangeText={setEditStartMinute}
                      placeholder="00"
                      placeholderTextColor={COLORS.textLight}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <Text style={styles.periodArrow}>→</Text>
                  <View style={styles.periodGroup}>
                    <TextInput
                      style={styles.periodInput}
                      value={editEndHour}
                      onChangeText={setEditEndHour}
                      placeholder="16"
                      placeholderTextColor={COLORS.textLight}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={styles.periodColon}>:</Text>
                    <TextInput
                      style={styles.periodInput}
                      value={editEndMinute}
                      onChangeText={setEditEndMinute}
                      placeholder="00"
                      placeholderTextColor={COLORS.textLight}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>

                {/* 메모 */}
                <Text style={styles.editSectionTitle}>📝 메모</Text>
                <TextInput
                  style={styles.descriptionInput}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="메모 (선택)"
                  placeholderTextColor={COLORS.textLight}
                  multiline
                />

                {/* 저장 버튼 */}
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                  <Text style={styles.saveButtonText}>💾 저장</Text>
                </TouchableOpacity>
              </View>
            )}
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
          <View style={styles.summaryRow}>
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
            {summary.penaltyMinutes > 0 && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryEmoji}>⚠️</Text>
                <Text style={styles.summaryLabel}>벌금</Text>
                <Text style={[styles.summaryValue, styles.penaltyValue]}>
                  -{minutesToTimeString(summary.penaltyMinutes)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 활동 목록 */}
        <View style={styles.activitiesCard}>
          <Text style={styles.activitiesTitle}>✨ 활동 기록</Text>

          {selectedDateActivities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>이 날은 기록이 없어요</Text>
            </View>
          ) : (
            selectedDateActivities.map((activity, index) => {
              const config = getActivityConfig(activity.category);
              const isEarn = activity.type === 'earn';
              const isSpend = activity.type === 'spend';
              const isPenalty = activity.type === 'penalty';

              return (
                <View
                  key={activity.id}
                  style={[
                    styles.activityItem,
                    index === selectedDateActivities.length - 1 && styles.activityItemLast,
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
                              ? '⏳ 대기'
                              : activity.status === 'approved'
                              ? '✅ 승인'
                              : '❌ 거절'}
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
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => handleEditActivity(activity)}
                      >
                        <Text style={styles.editButtonText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteActivity(activity)}
                      >
                        <Text style={styles.deleteButtonText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
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

  // 학생 정보 바
  studentBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  studentName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textWhite,
  },
  balanceChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  balanceChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textWhite,
    fontWeight: '600',
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

  // 수정 모달
  editContainer: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
    ...SHADOWS.large,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.cardAlt,
  },
  editTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  editClose: {
    fontSize: 24,
    color: COLORS.textSecondary,
    padding: SPACING.xs,
  },
  editContent: {
    padding: SPACING.md,
  },
  editActivityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.lg,
  },
  editActivityEmoji: {
    fontSize: 28,
    marginRight: SPACING.md,
  },
  editActivityLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  editSectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timeInput: {
    width: 60,
    height: 44,
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  timeLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  periodGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodInput: {
    width: 44,
    height: 40,
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.sm,
    textAlign: 'center',
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
  },
  periodColon: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginHorizontal: 2,
  },
  periodArrow: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
  },
  descriptionInput: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textWhite,
  },

  // 선택된 날짜 카드
  selectedDateCard: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
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
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: COLORS.cardAlt,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  summaryEmoji: {
    fontSize: 20,
    marginBottom: SPACING.xs,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    marginTop: SPACING.xs,
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
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  editButton: {
    padding: SPACING.xs,
  },
  editButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    padding: SPACING.xs,
  },
  deleteButtonText: {
    fontSize: 16,
  },
});

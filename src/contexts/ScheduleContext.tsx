import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { Schedule, DailyScheduleStatus, DayOfWeek } from '../types';

const SCHEDULES_STORAGE_KEY = '@sangjin_schedules';
const MIGRATION_FLAG_KEY = '@sangjin_schedules_migrated';

interface ScheduleContextType {
  schedules: Schedule[];
  dailyStatuses: DailyScheduleStatus[];
  addSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt' | 'userId' | 'familyCode'>) => Promise<void>;
  updateSchedule: (id: string, updates: Partial<Schedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  getTodaySchedules: () => Schedule[];
  getSchedulesForDay: (dayOfWeek: DayOfWeek) => Schedule[];
  getScheduleStatus: (scheduleId: string, date: string) => DailyScheduleStatus | undefined;
  markScheduleCompleted: (scheduleId: string, date: string, activityId: string) => Promise<void>;
  markScheduleAbsent: (scheduleId: string, date: string) => Promise<void>;
  resetScheduleStatus: (scheduleId: string, date: string) => Promise<void>;
  isLoading: boolean;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [dailyStatuses, setDailyStatuses] = useState<DailyScheduleStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const migrationAttempted = useRef(false);

  // AsyncStorage → Firestore 마이그레이션
  async function migrateFromAsyncStorage() {
    if (!user || migrationAttempted.current) return;
    migrationAttempted.current = true;

    try {
      // 이미 마이그레이션 완료된 경우 스킵
      const migrationFlag = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
      if (migrationFlag === 'done') {
        console.log('[Migration] Already migrated, skipping');
        return;
      }

      // AsyncStorage에서 기존 스케줄 읽기
      const storedSchedules = await AsyncStorage.getItem(SCHEDULES_STORAGE_KEY);
      if (!storedSchedules) {
        console.log('[Migration] No schedules to migrate');
        await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'done');
        return;
      }

      const oldSchedules = JSON.parse(storedSchedules);
      if (!Array.isArray(oldSchedules) || oldSchedules.length === 0) {
        console.log('[Migration] Empty schedules array');
        await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'done');
        return;
      }

      console.log(`[Migration] Found ${oldSchedules.length} schedules to migrate`);

      // Firestore로 마이그레이션
      for (const schedule of oldSchedules) {
        const newScheduleData = {
          name: schedule.name,
          emoji: schedule.emoji,
          category: schedule.category,
          daysOfWeek: schedule.daysOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          durationMinutes: schedule.durationMinutes,
          multiplier: schedule.multiplier,
          isActive: schedule.isActive ?? true,
          userId: user.id,
          familyCode: user.familyCode || null,
          createdAt: schedule.createdAt ? new Date(schedule.createdAt) : new Date(),
        };

        await addDoc(collection(db, 'schedules'), newScheduleData);
        console.log(`[Migration] Migrated schedule: ${schedule.name}`);
      }

      // 마이그레이션 완료 표시
      await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'done');
      console.log('[Migration] Migration completed successfully!');

      // 기존 데이터 삭제 (선택적)
      // await AsyncStorage.removeItem(SCHEDULES_STORAGE_KEY);
    } catch (error) {
      console.error('[Migration] Error during migration:', error);
    }
  }

  // Firestore에서 스케줄 데이터 실시간 구독
  useEffect(() => {
    if (!user) {
      setSchedules([]);
      setDailyStatuses([]);
      setIsLoading(false);
      migrationAttempted.current = false;
      return;
    }

    setIsLoading(true);

    // 마이그레이션 시도
    migrateFromAsyncStorage();

    // 스케줄 데이터 구독
    const schedulesRef = collection(db, 'schedules');
    const schedulesQuery = query(
      schedulesRef,
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubSchedules = onSnapshot(schedulesQuery, (snapshot) => {
      const loadedSchedules: Schedule[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          familyCode: data.familyCode,
          name: data.name,
          emoji: data.emoji,
          category: data.category,
          daysOfWeek: data.daysOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
          durationMinutes: data.durationMinutes,
          multiplier: data.multiplier,
          isActive: data.isActive,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
      setSchedules(loadedSchedules);
      setIsLoading(false);
    }, (error) => {
      console.error('Schedules subscription error:', error);
      setIsLoading(false);
    });

    // 일일 상태 데이터 구독
    const statusesRef = collection(db, 'scheduleStatuses');
    const statusesQuery = query(
      statusesRef,
      where('userId', '==', user.id)
    );

    const unsubStatuses = onSnapshot(statusesQuery, (snapshot) => {
      const loadedStatuses: DailyScheduleStatus[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          scheduleId: data.scheduleId,
          date: data.date,
          status: data.status,
          activityId: data.activityId,
        };
      });
      setDailyStatuses(loadedStatuses);
    }, (error) => {
      console.error('Schedule statuses subscription error:', error);
    });

    return () => {
      unsubSchedules();
      unsubStatuses();
    };
  }, [user]);

  // 스케줄 추가
  async function addSchedule(schedule: Omit<Schedule, 'id' | 'createdAt' | 'userId' | 'familyCode'>) {
    if (!user) throw new Error('로그인이 필요합니다');

    const newScheduleData = {
      ...schedule,
      userId: user.id,
      familyCode: user.familyCode || null,
      createdAt: new Date(),
    };

    await addDoc(collection(db, 'schedules'), newScheduleData);
  }

  // 스케줄 수정
  async function updateSchedule(id: string, updates: Partial<Schedule>) {
    if (!user) throw new Error('로그인이 필요합니다');

    const scheduleRef = doc(db, 'schedules', id);
    await updateDoc(scheduleRef, updates);
  }

  // 스케줄 삭제
  async function deleteSchedule(id: string) {
    if (!user) throw new Error('로그인이 필요합니다');

    // 스케줄 삭제
    await deleteDoc(doc(db, 'schedules', id));

    // 관련 상태도 삭제
    const statusesRef = collection(db, 'scheduleStatuses');
    const q = query(statusesRef, where('scheduleId', '==', id));
    const snapshot = await getDocs(q);

    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, 'scheduleStatuses', docSnap.id));
    }
  }

  // 오늘 스케줄 가져오기
  function getTodaySchedules(): Schedule[] {
    const today = new Date().getDay() as DayOfWeek;
    return schedules.filter(s => s.isActive && s.daysOfWeek.includes(today));
  }

  // 특정 요일 스케줄 가져오기
  function getSchedulesForDay(dayOfWeek: DayOfWeek): Schedule[] {
    return schedules.filter(s => s.isActive && s.daysOfWeek.includes(dayOfWeek));
  }

  // 스케줄 상태 가져오기
  function getScheduleStatus(scheduleId: string, date: string): DailyScheduleStatus | undefined {
    return dailyStatuses.find(s => s.scheduleId === scheduleId && s.date === date);
  }

  // 스케줄 완료 표시
  async function markScheduleCompleted(scheduleId: string, date: string, activityId: string) {
    if (!user) throw new Error('로그인이 필요합니다');

    const statusId = `${user.id}_${scheduleId}_${date}`;
    const statusRef = doc(db, 'scheduleStatuses', statusId);

    await setDoc(statusRef, {
      userId: user.id,
      scheduleId,
      date,
      status: 'completed',
      activityId,
    });
  }

  // 스케줄 결석 표시
  async function markScheduleAbsent(scheduleId: string, date: string) {
    if (!user) throw new Error('로그인이 필요합니다');

    const statusId = `${user.id}_${scheduleId}_${date}`;
    const statusRef = doc(db, 'scheduleStatuses', statusId);

    await setDoc(statusRef, {
      userId: user.id,
      scheduleId,
      date,
      status: 'absent',
      activityId: null,
    });
  }

  // 스케줄 상태 초기화
  async function resetScheduleStatus(scheduleId: string, date: string) {
    if (!user) throw new Error('로그인이 필요합니다');

    const statusId = `${user.id}_${scheduleId}_${date}`;
    await deleteDoc(doc(db, 'scheduleStatuses', statusId));
  }

  return (
    <ScheduleContext.Provider
      value={{
        schedules,
        dailyStatuses,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        getTodaySchedules,
        getSchedulesForDay,
        getScheduleStatus,
        markScheduleCompleted,
        markScheduleAbsent,
        resetScheduleStatus,
        isLoading,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedules() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedules must be used within a ScheduleProvider');
  }
  return context;
}

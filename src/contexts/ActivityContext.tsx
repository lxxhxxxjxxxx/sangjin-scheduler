import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { Activity, DailySummary } from '../types';

interface ActivityContextType {
  activities: Activity[];
  balance: number;
  todaySummary: DailySummary | null;
  pendingCount: number;
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt' | 'userId' | 'familyCode'>) => Promise<Activity>;
  deleteActivity: (id: string) => Promise<void>;
  getActivitiesByDate: (date: string) => Activity[];
  getDailySummary: (date: string) => DailySummary;
  loading: boolean;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Firestore에서 활동 데이터 실시간 구독
  useEffect(() => {
    if (!user) {
      setActivities([]);
      setBalance(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 활동 데이터 구독
    const activitiesRef = collection(db, 'activities');
    const activitiesQuery = query(
      activitiesRef,
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubActivities = onSnapshot(activitiesQuery, (snapshot) => {
      const loadedActivities: Activity[] = snapshot.docs.map((doc) => {
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
          approvedBy: data.approvedBy,
          approvedAt: data.approvedAt?.toDate(),
        };
      });
      setActivities(loadedActivities);
      setLoading(false);
    }, (error) => {
      console.error('Activities subscription error:', error);
      setLoading(false);
    });

    // 잔액 데이터 구독
    const balanceRef = doc(db, 'balances', user.id);
    const unsubBalance = onSnapshot(balanceRef, (snapshot) => {
      if (snapshot.exists()) {
        setBalance(snapshot.data().currentBalance || 0);
      } else {
        setBalance(0);
      }
    });

    return () => {
      unsubActivities();
      unsubBalance();
    };
  }, [user]);

  // 활동 추가
  async function addActivity(
    activityData: Omit<Activity, 'id' | 'createdAt' | 'userId' | 'familyCode'>
  ): Promise<Activity> {
    if (!user) throw new Error('로그인이 필요합니다');

    const newActivityData = {
      ...activityData,
      userId: user.id,
      familyCode: user.familyCode || null,
      date: activityData.date,
      description: activityData.description || null,
      startTime: activityData.startTime || null,
      endTime: activityData.endTime || null,
      createdAt: new Date(),
    };

    // Firestore에 저장
    const docRef = await addDoc(collection(db, 'activities'), newActivityData);

    // 잔액 업데이트
    let balanceChange = 0;
    if (activityData.status === 'approved') {
      if (activityData.type === 'earn') {
        balanceChange = activityData.earnedMinutes;
      } else if (activityData.type === 'spend' || activityData.type === 'penalty') {
        balanceChange = -activityData.earnedMinutes;
      }
    }

    if (balanceChange !== 0) {
      const balanceRef = doc(db, 'balances', user.id);
      const balanceDoc = await getDoc(balanceRef);
      const currentBalance = balanceDoc.exists() ? balanceDoc.data().currentBalance : 0;

      await setDoc(balanceRef, {
        currentBalance: currentBalance + balanceChange,
        lastUpdated: new Date(),
      }, { merge: true });
    }

    return {
      ...newActivityData,
      id: docRef.id,
      createdAt: new Date(),
    } as Activity;
  }

  // 활동 삭제
  async function deleteActivity(id: string): Promise<void> {
    if (!user) throw new Error('로그인이 필요합니다');

    // 삭제할 활동 찾기
    const activity = activities.find((a) => a.id === id);
    if (!activity) return;

    // Firestore에서 삭제
    await deleteDoc(doc(db, 'activities', id));

    // 잔액 복구
    if (activity.status === 'approved') {
      let balanceChange = 0;
      if (activity.type === 'earn') {
        balanceChange = -activity.earnedMinutes;
      } else if (activity.type === 'spend' || activity.type === 'penalty') {
        balanceChange = activity.earnedMinutes;
      }

      if (balanceChange !== 0) {
        const balanceRef = doc(db, 'balances', user.id);
        const balanceDoc = await getDoc(balanceRef);
        const currentBalance = balanceDoc.exists() ? balanceDoc.data().currentBalance : 0;

        await updateDoc(balanceRef, {
          currentBalance: currentBalance + balanceChange,
          lastUpdated: new Date(),
        });
      }
    }
  }

  // 날짜별 활동 가져오기
  function getActivitiesByDate(dateString: string): Activity[] {
    return activities.filter((a) => getDateString(a.date) === dateString);
  }

  // 일일 요약 계산
  function getDailySummary(dateString: string): DailySummary {
    const dayActivities = getActivitiesByDate(dateString);

    let earnedMinutes = 0;
    let spentMinutes = 0;
    let penaltyMinutes = 0;

    dayActivities.forEach((activity) => {
      if (activity.status !== 'approved') return;

      if (activity.type === 'earn') {
        earnedMinutes += activity.earnedMinutes;
      } else if (activity.type === 'spend') {
        spentMinutes += activity.earnedMinutes;
      } else if (activity.type === 'penalty') {
        penaltyMinutes += activity.earnedMinutes;
      }
    });

    // 전날 잔액 계산 (현재 잔액에서 오늘 변동분 빼기)
    const todayChange = earnedMinutes - spentMinutes - penaltyMinutes;
    const previousBalance = balance - todayChange;

    return {
      date: dateString,
      earnedMinutes,
      spentMinutes,
      penaltyMinutes,
      previousBalance,
      currentBalance: balance,
      activities: dayActivities.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    };
  }

  // 오늘 요약
  const todaySummary = getDailySummary(getTodayString());

  // 미승인 활동 수
  const pendingCount = activities.filter((a) => a.status === 'pending').length;

  return (
    <ActivityContext.Provider
      value={{
        activities,
        balance,
        todaySummary,
        pendingCount,
        addActivity,
        deleteActivity,
        getActivitiesByDate,
        getDailySummary,
        loading,
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivities() {
  const context = useContext(ActivityContext);
  if (context === undefined) {
    throw new Error('useActivities must be used within an ActivityProvider');
  }
  return context;
}

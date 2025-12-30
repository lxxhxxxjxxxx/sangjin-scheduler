// 활동 타입
export type ActivityType = 'earn' | 'spend' | 'neutral' | 'penalty';

// 활동 카테고리
export type EarnCategory =
  | 'academy'        // 학원/과외 공부
  | 'homework'       // 숙제
  | 'self_study'     // 스스로 공부
  | 'reading'        // 독서 + 독후감
  | 'good_deed'      // 좋은 일
  | 'coding'         // 코딩/AI
  | 'app_complete'   // 앱 완성
  | 'app_store'      // 앱스토어 배포
  | 'holiday_bonus'; // 휴일 기본

export type SpendCategory =
  | 'game'           // 게임
  | 'youtube'        // 유튜브
  | 'item_exchange'; // 아이템 교환 (10시간 → 3만원)

export type NeutralCategory =
  | 'drawing'        // 그림 그리기
  | 'game_creation'; // 게임에서 게임 만들기

export type PenaltyCategory =
  | 'no_record'      // 미기록 (-1시간)
  | 'no_balance'     // 잔액 없이 사용 (-2시간)
  | 'lying';         // 거짓말 (-10시간)

export type ActivityCategory =
  | EarnCategory
  | SpendCategory
  | NeutralCategory
  | PenaltyCategory;

// 과목 정보
export interface Subject {
  id: string;
  name: string;                   // 예: "국어", "수학"
  emoji: string;                  // 예: "📖", "🔢"
  isDefault?: boolean;            // 기본 과목 여부
}

// 기본 과목 목록
export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'korean', name: '국어', emoji: '📖', isDefault: true },
  { id: 'english', name: '영어', emoji: '🔤', isDefault: true },
  { id: 'math', name: '수학', emoji: '🔢', isDefault: true },
];

// 활동 기록
export interface Activity {
  id: string;
  userId: string;               // 사용자 ID
  familyCode?: string | null;   // 가족 코드
  date: Date;
  type: ActivityType;
  category: ActivityCategory;
  subject?: string;             // 과목 (숙제, 스스로 공부용)
  durationMinutes: number;      // 실제 활동 시간 (분)
  multiplier: number;           // 배율
  earnedMinutes: number;        // 벌거나 쓴 시간 (분)
  needsApproval: boolean;       // 부모 확인 필요
  status: 'pending' | 'approved' | 'rejected';
  description?: string;         // 설명 (선택)
  startTime?: string;           // 시작 시간 (HH:MM)
  endTime?: string;             // 종료 시간 (HH:MM)
  createdAt: Date;
  approvedBy?: string;          // 승인한 부모 ID
  approvedAt?: Date;            // 승인 시간
}

// 일별 요약
export interface DailySummary {
  date: string;                 // YYYY-MM-DD
  previousBalance: number;      // 전날 저금 (분)
  earnedMinutes: number;        // 번 시간 (분)
  spentMinutes: number;         // 쓴 시간 (분)
  penaltyMinutes: number;       // 벌금 (분)
  currentBalance: number;       // 오늘 저금 (분)
  activities: Activity[];
}

// 사용자 정보
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'parent';
  familyCode?: string | null;           // 학생: 본인의 가족 코드
  linkedFamilyCode?: string | null;     // 부모: 연결된 학생의 가족 코드
  createdAt: Date;
}

// 요일 타입 (0: 일요일, 1: 월요일, ...)
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_NAMES: Record<DayOfWeek, string> = {
  0: '일',
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
};

// 반복 스케줄 (학원, 과외 등)
export interface Schedule {
  id: string;
  userId: string;                    // 사용자 ID
  familyCode?: string | null;        // 가족 코드
  name: string;                      // 예: "수학학원", "영어과외"
  emoji: string;                     // 이모지
  category: EarnCategory;            // 활동 카테고리 (주로 academy)
  daysOfWeek: DayOfWeek[];           // 반복 요일
  startTime: string;                 // 시작 시간 (HH:MM)
  endTime: string;                   // 종료 시간 (HH:MM)
  durationMinutes: number;           // 활동 시간 (분)
  multiplier: number;                // 배율
  isActive: boolean;                 // 활성화 여부
  createdAt: Date;
}

// 특정 날짜의 스케줄 상태
export interface DailyScheduleStatus {
  id?: string;                       // Firestore 문서 ID
  userId?: string;                   // 사용자 ID
  scheduleId: string;
  date: string;                      // YYYY-MM-DD
  status: 'pending' | 'completed' | 'absent';
  activityId?: string;               // 완료된 경우 활동 ID
}

// 헬퍼 함수: 분을 시간 문자열로 변환
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? '-' : '';

  if (hours === 0) {
    return `${sign}${mins}분`;
  }
  if (mins === 0) {
    return `${sign}${hours}시간`;
  }
  return `${sign}${hours}시간 ${mins}분`;
}

// 헬퍼 함수: 시간을 분으로 변환
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

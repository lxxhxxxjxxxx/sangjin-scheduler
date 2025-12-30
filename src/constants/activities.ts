import { ActivityCategory, ActivityType } from '../types';

export interface ActivityConfig {
  category: ActivityCategory;
  type: ActivityType;
  label: string;
  emoji: string;
  multiplier: number;           // 배율 (시간 버는 활동)
  fixedMinutes?: number;        // 고정 시간 (분)
  needsApproval: boolean;       // 부모 확인 필요
  description?: string;
}

// 시간 버는 활동
export const EARN_ACTIVITIES: ActivityConfig[] = [
  {
    category: 'holiday_bonus',
    type: 'earn',
    label: '휴일 기본',
    emoji: '🎉',
    multiplier: 1,
    fixedMinutes: 60, // 1시간 고정
    needsApproval: false,
    description: '휴일에는 기본 1시간',
  },
  {
    category: 'academy',
    type: 'earn',
    label: '학원/과외 공부',
    emoji: '📚',
    multiplier: 1,
    needsApproval: false,
  },
  {
    category: 'homework',
    type: 'earn',
    label: '숙제',
    emoji: '✏️',
    multiplier: 1,
    needsApproval: false,
  },
  {
    category: 'self_study',
    type: 'earn',
    label: '스스로 공부',
    emoji: '📖',
    multiplier: 1.5,
    needsApproval: true,
    description: '엄마에게 확인 필요',
  },
  {
    category: 'reading',
    type: 'earn',
    label: '독서 + 독후감',
    emoji: '📕',
    multiplier: 1.5,
    needsApproval: true,
    description: '책 읽고 독후감 써서 엄마에게 확인',
  },
  {
    category: 'good_deed',
    type: 'earn',
    label: '좋은 일',
    emoji: '💖',
    multiplier: 1.5,
    needsApproval: true,
    description: '엄마에게 확인 필요',
  },
  {
    category: 'coding',
    type: 'earn',
    label: '코딩/AI',
    emoji: '💻',
    multiplier: 2,
    needsApproval: true,
    description: '아빠에게 확인 필요',
  },
  {
    category: 'app_complete',
    type: 'earn',
    label: '앱 완성',
    emoji: '🚀',
    multiplier: 1,
    fixedMinutes: 6000, // 100시간
    needsApproval: true,
    description: '앱 한개 스스로 만들어서 아빠에게 확인',
  },
  {
    category: 'app_store',
    type: 'earn',
    label: '앱스토어 배포',
    emoji: '🏆',
    multiplier: 1,
    fixedMinutes: 60000, // 1000시간
    needsApproval: true,
    description: '애플 스토어에 앱 올리기',
  },
];

// 시간 쓰는 활동
export const SPEND_ACTIVITIES: ActivityConfig[] = [
  {
    category: 'game',
    type: 'spend',
    label: '게임',
    emoji: '🎮',
    multiplier: 1,
    needsApproval: false,
  },
  {
    category: 'youtube',
    type: 'spend',
    label: '유튜브',
    emoji: '📺',
    multiplier: 1,
    needsApproval: false,
  },
  {
    category: 'item_exchange',
    type: 'spend',
    label: '아이템 교환',
    emoji: '🎁',
    multiplier: 1,
    fixedMinutes: 600, // 10시간 = 3만원
    needsApproval: true,
    description: '10시간 저금 → 3만원 아이템',
  },
];

// 중립 활동
export const NEUTRAL_ACTIVITIES: ActivityConfig[] = [
  {
    category: 'drawing',
    type: 'neutral',
    label: '그림 그리기',
    emoji: '🎨',
    multiplier: 0,
    needsApproval: false,
    description: '시간 벌기/쓰기에 포함되지 않음',
  },
  {
    category: 'game_creation',
    type: 'neutral',
    label: '게임에서 게임 만들기',
    emoji: '🕹️',
    multiplier: 0,
    needsApproval: false,
    description: '시간 벌기/쓰기에 포함되지 않음',
  },
];

// 벌금
export const PENALTY_ACTIVITIES: ActivityConfig[] = [
  {
    category: 'no_record',
    type: 'penalty',
    label: '미기록 벌금',
    emoji: '⚠️',
    multiplier: 1,
    fixedMinutes: 60, // 1시간
    needsApproval: false,
    description: '시간 관리 기록 안하면 벌금 1시간',
  },
  {
    category: 'no_balance',
    type: 'penalty',
    label: '잔액 초과 벌금',
    emoji: '🚫',
    multiplier: 1,
    fixedMinutes: 120, // 2시간
    needsApproval: false,
    description: '시간 안남아 있는데 게임/유튜브하면 벌금 2시간',
  },
  {
    category: 'lying',
    type: 'penalty',
    label: '거짓말 벌금',
    emoji: '❌',
    multiplier: 1,
    fixedMinutes: 600, // 10시간
    needsApproval: false,
    description: '거짓말로 시간 기록하면 벌금 10시간',
  },
];

// 모든 활동
export const ALL_ACTIVITIES: ActivityConfig[] = [
  ...EARN_ACTIVITIES,
  ...SPEND_ACTIVITIES,
  ...NEUTRAL_ACTIVITIES,
  ...PENALTY_ACTIVITIES,
];

// 카테고리로 활동 찾기
export function getActivityConfig(category: ActivityCategory): ActivityConfig | undefined {
  return ALL_ACTIVITIES.find((a) => a.category === category);
}

// 아달이 시간 관리 앱 - 테마 설정
// 컨셉: "시간 저금통" - 귀엽고 게임 같은 느낌

export const COLORS = {
  // 배경
  background: '#FFF8F0',        // 따뜻한 크림색
  card: '#FFFFFF',
  cardAlt: '#FEF3E2',           // 연한 피치

  // 메인 컬러
  primary: '#6366F1',           // 인디고 (메인 브랜드)
  earn: '#10B981',              // 에메랄드 그린 (시간 벌기)
  spend: '#F472B6',             // 핑크 (시간 쓰기)
  neutral: '#A78BFA',           // 퍼플 (기타)
  penalty: '#EF4444',           // 레드 (벌금)

  // 골드/코인
  gold: '#FBBF24',              // 골드
  goldLight: '#FDE68A',         // 연한 골드
  goldDark: '#D97706',          // 진한 골드

  // 텍스트
  textPrimary: '#1F2937',       // 거의 검정
  textSecondary: '#6B7280',     // 회색
  textLight: '#9CA3AF',         // 연한 회색
  textWhite: '#FFFFFF',

  // 기타
  border: '#E5E7EB',
  shadow: '#000000',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
};

export const SHADOWS = {
  small: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  }),
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  huge: 48,
};

// 귀여운 이모지 세트
export const MASCOT = {
  happy: '😊',
  excited: '🤩',
  money: '🐷',        // 저금통 돼지
  coin: '🪙',
  star: '⭐',
  fire: '🔥',
  sparkle: '✨',
  trophy: '🏆',
  warning: '😰',
  sad: '😢',
};

/**
 * 대한민국 공휴일 체크 유틸리티
 * - 토요일/일요일 (주말)
 * - 고정 공휴일 (신정, 삼일절, 어린이날, 현충일, 광복절, 개천절, 한글날, 성탄절)
 * - 음력 공휴일 (설날, 추석, 석가탄신일) - 미리 계산된 날짜 사용
 */

// 고정 공휴일 (월-일)
const FIXED_HOLIDAYS: { [monthDay: string]: string } = {
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '성탄절',
};

// 음력 기반 공휴일 (설날, 추석, 석가탄신일) - 미리 계산된 날짜
// 설날: 음력 1월 1일 ± 1일
// 추석: 음력 8월 15일 ± 1일
// 석가탄신일: 음력 4월 8일
const LUNAR_HOLIDAYS: { [year: number]: { [date: string]: string } } = {
  2024: {
    '02-09': '설날 연휴',
    '02-10': '설날',
    '02-11': '설날 연휴',
    '02-12': '설날 대체공휴일',
    '05-15': '석가탄신일',
    '09-16': '추석 연휴',
    '09-17': '추석',
    '09-18': '추석 연휴',
  },
  2025: {
    '01-28': '설날 연휴',
    '01-29': '설날',
    '01-30': '설날 연휴',
    '05-05': '석가탄신일',
    '10-05': '추석 연휴',
    '10-06': '추석',
    '10-07': '추석 연휴',
    '10-08': '추석 대체공휴일',
  },
  2026: {
    '02-16': '설날 연휴',
    '02-17': '설날',
    '02-18': '설날 연휴',
    '05-24': '석가탄신일',
    '05-25': '석가탄신일 대체공휴일',
    '09-24': '추석 연휴',
    '09-25': '추석',
    '09-26': '추석 연휴',
  },
  2027: {
    '02-05': '설날 연휴',
    '02-06': '설날',
    '02-07': '설날 연휴',
    '02-08': '설날 대체공휴일',
    '05-13': '석가탄신일',
    '09-14': '추석 연휴',
    '09-15': '추석',
    '09-16': '추석 연휴',
  },
  2028: {
    '01-25': '설날 연휴',
    '01-26': '설날',
    '01-27': '설날 연휴',
    '05-02': '석가탄신일',
    '10-02': '추석 연휴',
    '10-03': '추석',
    '10-04': '추석 연휴',
  },
  2029: {
    '02-12': '설날 연휴',
    '02-13': '설날',
    '02-14': '설날 연휴',
    '05-20': '석가탄신일',
    '05-21': '석가탄신일 대체공휴일',
    '09-21': '추석 연휴',
    '09-22': '추석',
    '09-23': '추석 연휴',
    '09-24': '추석 대체공휴일',
  },
  2030: {
    '02-02': '설날 연휴',
    '02-03': '설날',
    '02-04': '설날 연휴',
    '05-09': '석가탄신일',
    '09-11': '추석 연휴',
    '09-12': '추석',
    '09-13': '추석 연휴',
  },
};

/**
 * 주어진 날짜가 주말인지 체크
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 일요일(0) 또는 토요일(6)
}

/**
 * 주어진 날짜가 공휴일인지 체크
 */
export function isPublicHoliday(date: Date): { isHoliday: boolean; name?: string } {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const monthDay = `${month}-${day}`;

  // 고정 공휴일 체크
  if (FIXED_HOLIDAYS[monthDay]) {
    return { isHoliday: true, name: FIXED_HOLIDAYS[monthDay] };
  }

  // 음력 공휴일 체크
  const yearHolidays = LUNAR_HOLIDAYS[year];
  if (yearHolidays && yearHolidays[monthDay]) {
    return { isHoliday: true, name: yearHolidays[monthDay] };
  }

  return { isHoliday: false };
}

/**
 * 주어진 날짜가 휴일(주말 또는 공휴일)인지 체크
 */
export function isHoliday(date: Date): { isHoliday: boolean; reason?: string } {
  // 주말 체크
  if (isWeekend(date)) {
    const dayName = date.getDay() === 0 ? '일요일' : '토요일';
    return { isHoliday: true, reason: dayName };
  }

  // 공휴일 체크
  const holiday = isPublicHoliday(date);
  if (holiday.isHoliday) {
    return { isHoliday: true, reason: holiday.name };
  }

  return { isHoliday: false };
}

/**
 * 오늘이 휴일인지 체크
 */
export function isTodayHoliday(): { isHoliday: boolean; reason?: string } {
  return isHoliday(new Date());
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 이번 달의 모든 휴일 가져오기 (캘린더 표시용)
 */
export function getHolidaysInMonth(year: number, month: number): { [date: string]: string } {
  const holidays: { [date: string]: string } = {};
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const result = isHoliday(date);
    if (result.isHoliday && result.reason) {
      const dateStr = formatDateString(date);
      holidays[dateStr] = result.reason;
    }
  }

  return holidays;
}

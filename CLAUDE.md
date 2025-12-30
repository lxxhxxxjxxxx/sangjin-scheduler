# 아달이 시간 관리 앱

## WHY (목적)
아이가 "시간을 벌고 쓰는" 경험을 통해 자기 관리 능력을 기르는 앱.
공부/독서/코딩으로 시간을 벌고, 게임/유튜브로 시간을 쓴다.

## WHAT (구조)
```
src/
├── config/         # Firebase 설정
├── contexts/       # React Context (Auth, Activities)
├── hooks/          # 커스텀 훅
├── screens/        # 화면 컴포넌트
│   ├── auth/       # 로그인/회원가입
│   ├── student/    # 학생용 화면
│   └── parent/     # 부모용 화면
├── components/     # 재사용 UI 컴포넌트
├── constants/      # 활동 타입, 배율 정의
└── types/          # TypeScript 타입
```

**기술 스택**: React Native (Expo) + Firebase (Auth, Firestore)

## HOW (작업 방법)

```bash
# 개발 서버 실행
npx expo start

# 타입 체크
npx tsc --noEmit

# 빌드
npx expo build
```

## 핵심 비즈니스 로직

**시간 버는 활동 (배율)**
- 학원/숙제: 1배
- 스스로 공부/독서/좋은일: 1.5배 (부모 확인 필요)
- 코딩/AI: 2배 (부모 확인 필요)
- 앱 완성: +100시간, 앱스토어 배포: +1000시간

**시간 쓰는 활동**
- 게임/유튜브: 1:1 소비
- 10시간 저금 → 3만원 아이템 교환

**벌금**
- 미기록: -1시간
- 잔액 없이 사용: -2시간
- 거짓말: -10시간

## 주의사항
- 시간은 내부적으로 **분 단위**로 저장, UI에서는 시간으로 표시
- 부모 확인이 필요한 활동은 `needsApproval: true`

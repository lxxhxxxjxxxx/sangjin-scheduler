import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/theme';

interface RegisterScreenProps {
  onSwitchToLogin: () => void;
}

export default function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
  const { register, loading, error, clearError } = useAuth();
  const [step, setStep] = useState<'role' | 'form'>('role');
  const [role, setRole] = useState<'student' | 'parent'>('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [emailChecked, setEmailChecked] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // 이메일 중복 체크
  async function handleCheckEmail() {
    if (!email.trim()) {
      setLocalError('이메일을 입력해주세요');
      return;
    }

    // 간단한 이메일 형식 체크
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setLocalError('올바른 이메일 형식이 아닙니다');
      return;
    }

    setCheckingEmail(true);
    setLocalError(null);

    try {
      const methods = await fetchSignInMethodsForEmail(auth, email.trim());
      if (methods.length > 0) {
        setEmailAvailable(false);
        setEmailChecked(true);
        setLocalError('이미 사용 중인 이메일입니다');
      } else {
        setEmailAvailable(true);
        setEmailChecked(true);
      }
    } catch (err: any) {
      // 이메일 열거 보호가 활성화된 경우 빈 배열 반환됨
      // 그냥 사용 가능으로 처리하고 가입 시 에러 처리
      setEmailAvailable(true);
      setEmailChecked(true);
    } finally {
      setCheckingEmail(false);
    }
  }

  // 비밀번호 일치 여부 확인
  function getPasswordMatchStatus() {
    if (!confirmPassword) return null;
    return password === confirmPassword;
  }

  async function handleRegister() {
    setLocalError(null);

    if (!name.trim()) {
      setLocalError('이름을 입력해주세요');
      return;
    }
    if (!email.trim()) {
      setLocalError('이메일을 입력해주세요');
      return;
    }
    if (!emailChecked || !emailAvailable) {
      setLocalError('이메일 중복 확인을 해주세요');
      return;
    }
    if (!password) {
      setLocalError('비밀번호를 입력해주세요');
      return;
    }
    if (password.length < 6) {
      setLocalError('비밀번호는 6자 이상이어야 합니다');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('비밀번호가 일치하지 않습니다');
      return;
    }

    try {
      await register(email.trim(), password, name.trim(), role);
    } catch (err) {
      // 에러는 AuthContext에서 처리됨
    }
  }

  // 역할 선택 화면
  if (step === 'role') {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoSection}>
            <Text style={styles.logoEmoji}>🐷</Text>
            <Text style={styles.logoTitle}>아달이 시간 저금통</Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formTitle}>회원가입</Text>
            <Text style={styles.roleQuestion}>누구로 가입할까요?</Text>

            <TouchableOpacity
              style={[styles.roleCard, role === 'student' && styles.roleCardSelected]}
              onPress={() => setRole('student')}
            >
              <Text style={styles.roleEmoji}>👦</Text>
              <View style={styles.roleInfo}>
                <Text style={[styles.roleName, role === 'student' && styles.roleNameSelected]}>
                  학생
                </Text>
                <Text style={styles.roleDesc}>시간을 벌고 쓰며 저금해요</Text>
              </View>
              {role === 'student' && (
                <View style={styles.roleCheck}>
                  <Text style={styles.roleCheckText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleCard, role === 'parent' && styles.roleCardSelected]}
              onPress={() => setRole('parent')}
            >
              <Text style={styles.roleEmoji}>👨‍👩‍👦</Text>
              <View style={styles.roleInfo}>
                <Text style={[styles.roleName, role === 'parent' && styles.roleNameSelected]}>
                  부모님
                </Text>
                <Text style={styles.roleDesc}>아이의 활동을 확인하고 관리해요</Text>
              </View>
              {role === 'parent' && (
                <View style={styles.roleCheck}>
                  <Text style={styles.roleCheckText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => setStep('form')}
            >
              <Text style={styles.nextButtonText}>다음</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backToLogin}
              onPress={onSwitchToLogin}
            >
              <Text style={styles.backToLoginText}>이미 계정이 있어요</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // 정보 입력 화면
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoSection}>
          <Text style={styles.logoEmoji}>{role === 'student' ? '👦' : '👨‍👩‍👦'}</Text>
          <Text style={styles.logoTitle}>
            {role === 'student' ? '학생' : '부모님'} 계정 만들기
          </Text>
        </View>

        <View style={styles.formSection}>
          {(error || localError) && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error || localError}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>이름</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setLocalError(null);
                clearError();
              }}
              placeholder={role === 'student' ? '예: 홍길동' : '예: 홍부모'}
              placeholderTextColor={COLORS.textLight}
              autoComplete="name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>이메일</Text>
            <View style={styles.emailInputRow}>
              <TextInput
                style={[styles.input, styles.emailInput]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailChecked(false);
                  setEmailAvailable(false);
                  setLocalError(null);
                  clearError();
                }}
                placeholder="example@email.com"
                placeholderTextColor={COLORS.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <TouchableOpacity
                style={[
                  styles.checkButton,
                  checkingEmail && styles.checkButtonDisabled,
                  emailChecked && emailAvailable && styles.checkButtonSuccess,
                ]}
                onPress={handleCheckEmail}
                disabled={checkingEmail}
              >
                {checkingEmail ? (
                  <ActivityIndicator size="small" color={COLORS.textWhite} />
                ) : (
                  <Text style={styles.checkButtonText}>
                    {emailChecked && emailAvailable ? '확인됨' : '중복확인'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {emailChecked && emailAvailable && (
              <Text style={styles.successText}>사용 가능한 이메일입니다</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>비밀번호</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setLocalError(null);
                clearError();
              }}
              placeholder="6자 이상"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>비밀번호 확인</Text>
            <TextInput
              style={[
                styles.input,
                getPasswordMatchStatus() === true && styles.inputSuccess,
                getPasswordMatchStatus() === false && styles.inputError,
              ]}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setLocalError(null);
              }}
              placeholder="비밀번호 다시 입력"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              autoComplete="new-password"
            />
            {getPasswordMatchStatus() === true && (
              <Text style={styles.successText}>비밀번호가 일치합니다</Text>
            )}
            {getPasswordMatchStatus() === false && (
              <Text style={styles.errorTextSmall}>비밀번호가 일치하지 않습니다</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.nextButton, loading && styles.nextButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <Text style={styles.nextButtonText}>회원가입</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('role')}
          >
            <Text style={styles.backButtonText}>← 역할 다시 선택</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoEmoji: {
    fontSize: 60,
    marginBottom: SPACING.md,
  },
  logoTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  formSection: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.large,
  },
  formTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  roleQuestion: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  roleEmoji: {
    fontSize: 40,
    marginRight: SPACING.md,
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  roleNameSelected: {
    color: COLORS.primary,
  },
  roleDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  roleCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleCheckText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  errorBox: {
    backgroundColor: `${COLORS.error}15`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputSuccess: {
    borderColor: COLORS.success,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  emailInputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  emailInput: {
    flex: 1,
  },
  checkButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  checkButtonDisabled: {
    opacity: 0.7,
  },
  checkButtonSuccess: {
    backgroundColor: COLORS.success,
  },
  checkButtonText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
  },
  successText: {
    color: COLORS.success,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
  errorTextSmall: {
    color: COLORS.error,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
    ...SHADOWS.small,
  },
  nextButtonDisabled: {
    opacity: 0.7,
  },
  nextButtonText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  backToLogin: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  backToLoginText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
  },
  backButton: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  backButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
});

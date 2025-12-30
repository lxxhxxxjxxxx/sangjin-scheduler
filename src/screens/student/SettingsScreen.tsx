import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useSubjects } from '../../contexts/SubjectContext';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/theme';

const EMOJI_OPTIONS = ['📕', '📗', '📘', '📙', '🔬', '🌍', '🎵', '💻', '🎨', '⚽', '📐', '🧪'];

function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

function showConfirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      { text: '확인', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

export default function SettingsScreen() {
  const { user, logout, updateUserName, deleteAccount } = useAuth();
  const { subjects, addSubject, deleteSubject } = useSubjects();
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  // 과목 추가 모달 상태
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectEmoji, setNewSubjectEmoji] = useState('📕');
  const [addingSubject, setAddingSubject] = useState(false);

  async function handleSaveName() {
    if (!user || !newName.trim()) return;

    setSaving(true);
    try {
      await updateUserName(newName.trim());
      showAlert('저장 완료', '이름이 변경되었습니다');
      setIsEditing(false);
    } catch (error) {
      console.error('Name update error:', error);
      showAlert('오류', '이름 변경에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    showConfirm('로그아웃', '정말 로그아웃할까요?', async () => {
      await logout();
    });
  }

  function handleDeleteAccount() {
    showConfirm(
      '회원 탈퇴',
      '정말 탈퇴할까요? 모든 데이터가 삭제되며 복구할 수 없습니다.',
      async () => {
        try {
          await deleteAccount();
        } catch (error) {
          console.error('Delete account error:', error);
          showAlert('오류', '회원 탈퇴에 실패했습니다');
        }
      }
    );
  }

  async function handleAddSubject() {
    if (!newSubjectName.trim()) {
      showAlert('오류', '과목 이름을 입력해주세요');
      return;
    }

    setAddingSubject(true);
    try {
      await addSubject(newSubjectName.trim(), newSubjectEmoji);
      showAlert('추가 완료', `${newSubjectEmoji} ${newSubjectName} 과목이 추가되었습니다`);
      setShowAddSubject(false);
      setNewSubjectName('');
      setNewSubjectEmoji('📕');
    } catch (error: any) {
      showAlert('오류', error.message || '과목 추가에 실패했습니다');
    } finally {
      setAddingSubject(false);
    }
  }

  function handleDeleteSubject(subject: { id: string; name: string; isDefault?: boolean }) {
    if (subject.isDefault) {
      showAlert('삭제 불가', '기본 과목은 삭제할 수 없습니다');
      return;
    }

    showConfirm('과목 삭제', `"${subject.name}" 과목을 삭제할까요?`, async () => {
      try {
        await deleteSubject(subject.id);
        showAlert('삭제 완료', '과목이 삭제되었습니다');
      } catch (error) {
        showAlert('오류', '과목 삭제에 실패했습니다');
      }
    });
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 프로필 카드 */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatar}>
            {user?.role === 'student' ? '👦' : '👨‍👩‍👦'}
          </Text>
        </View>

        {isEditing ? (
          <View style={styles.editNameContainer}>
            <TextInput
              style={styles.nameInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="이름 입력"
              placeholderTextColor={COLORS.textLight}
              autoFocus
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsEditing(false);
                  setNewName(user?.name || '');
                }}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveName}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={COLORS.textWhite} />
                ) : (
                  <Text style={styles.saveButtonText}>저장</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setIsEditing(true)}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.editHint}>터치하여 이름 수정</Text>
          </TouchableOpacity>
        )}

        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {user?.role === 'student' ? '학생' : '부모님'}
          </Text>
        </View>
      </View>

      {/* 계정 정보 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>계정 정보</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>이메일</Text>
          <Text style={styles.infoValue}>{user?.email}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>역할</Text>
          <Text style={styles.infoValue}>
            {user?.role === 'student' ? '학생' : '부모님'}
          </Text>
        </View>

        {user?.familyCode && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>가족 코드</Text>
            <Text style={styles.familyCodeValue}>{user.familyCode}</Text>
          </View>
        )}

        {user?.linkedFamilyCode && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>연결된 가족</Text>
            <Text style={styles.infoValue}>{user.linkedFamilyCode}</Text>
          </View>
        )}
      </View>

      {/* 과목 관리 (학생만) */}
      {user?.role === 'student' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📚 과목 관리</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddSubject(true)}
            >
              <Text style={styles.addButtonText}>+ 추가</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.subjectList}>
            {subjects.map((subject) => (
              <View key={subject.id} style={styles.subjectItem}>
                <Text style={styles.subjectEmoji}>{subject.emoji}</Text>
                <Text style={styles.subjectName}>{subject.name}</Text>
                {subject.isDefault ? (
                  <Text style={styles.defaultBadge}>기본</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.deleteSubjectButton}
                    onPress={() => handleDeleteSubject(subject)}
                  >
                    <Text style={styles.deleteSubjectText}>🗑️</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 과목 추가 모달 */}
      <Modal
        visible={showAddSubject}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddSubject(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddSubject(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>📚 과목 추가</Text>

            <Text style={styles.inputLabel}>이모지 선택</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScroll}>
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiOption,
                      newSubjectEmoji === emoji && styles.emojiOptionSelected,
                    ]}
                    onPress={() => setNewSubjectEmoji(emoji)}
                  >
                    <Text style={styles.emojiOptionText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.inputLabel}>과목 이름</Text>
            <TextInput
              style={styles.subjectInput}
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              placeholder="예: 과학, 사회"
              placeholderTextColor={COLORS.textLight}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowAddSubject(false)}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, addingSubject && styles.modalSaveButtonDisabled]}
                onPress={handleAddSubject}
                disabled={addingSubject}
              >
                {addingSubject ? (
                  <ActivityIndicator size="small" color={COLORS.textWhite} />
                ) : (
                  <Text style={styles.modalSaveText}>추가</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 로그아웃 */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>로그아웃</Text>
      </TouchableOpacity>

      {/* 회원 탈퇴 */}
      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Text style={styles.deleteButtonText}>회원 탈퇴</Text>
      </TouchableOpacity>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  profileCard: {
    backgroundColor: COLORS.card,
    margin: SPACING.md,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatar: {
    fontSize: 50,
  },
  userName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  editHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  editNameContainer: {
    width: '100%',
    alignItems: 'center',
  },
  nameInput: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
    textAlign: 'center',
    width: '100%',
    marginBottom: SPACING.md,
  },
  editButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelButton: {
    backgroundColor: COLORS.cardAlt,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  roleBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.md,
  },
  roleBadgeText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  section: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  familyCodeValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  logoutButton: {
    backgroundColor: COLORS.error,
    marginHorizontal: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  logoutButtonText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.textLight,
  },
  deleteButtonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.md,
  },

  // 과목 관리
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  addButtonText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  subjectList: {
    gap: SPACING.sm,
  },
  subjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardAlt,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  subjectEmoji: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  subjectName: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  defaultBadge: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    backgroundColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  deleteSubjectButton: {
    padding: SPACING.xs,
  },
  deleteSubjectText: {
    fontSize: 18,
  },

  // 과목 추가 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
    ...SHADOWS.large,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  emojiScroll: {
    marginBottom: SPACING.md,
  },
  emojiGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  emojiOption: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}15`,
  },
  emojiOptionText: {
    fontSize: 24,
  },
  subjectInput: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: COLORS.cardAlt,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.7,
  },
  modalSaveText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textWhite,
  },
});

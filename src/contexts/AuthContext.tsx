import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  register: (email: string, password: string, name: string, role: 'student' | 'parent') => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  linkToStudent: (familyCode: string) => Promise<void>;
  getLinkedStudentInfo: () => Promise<{ name: string; balance: number } | null>;
  updateUserName: (newName: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 가족 코드 생성 함수
function generateFamilyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 회원가입/로그인 중일 때 플래그
  const authOperationRef = useRef<'none' | 'registering' | 'logging_in'>('none');

  // Firestore에서 사용자 정보 가져오기 함수
  async function fetchUserFromFirestore(uid: string, email: string): Promise<User | null> {
    console.log('[Auth] Fetching user doc for:', uid);
    const userDoc = await getDoc(doc(db, 'users', uid));
    console.log('[Auth] User doc exists:', userDoc.exists());

    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('[Auth] User data:', userData);
      return {
        id: uid,
        email: email,
        name: userData.name,
        role: userData.role,
        familyCode: userData.familyCode,
        linkedFamilyCode: userData.linkedFamilyCode,
        createdAt: userData.createdAt?.toDate() || new Date(),
      };
    }
    return null;
  }

  // Firebase Auth 상태 변화 감지
  useEffect(() => {
    console.log('[Auth] Setting up onAuthStateChanged listener');
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log('[Auth] onAuthStateChanged fired:', fbUser?.uid, 'operation:', authOperationRef.current);

      setFirebaseUser(fbUser);

      // 회원가입/로그인 중이면 해당 함수에서 직접 처리
      if (authOperationRef.current !== 'none') {
        console.log('[Auth] Skipping - auth operation in progress');
        return;
      }

      if (fbUser) {
        const userData = await fetchUserFromFirestore(fbUser.uid, fbUser.email || '');
        if (userData) {
          setUser(userData);
        } else {
          console.log('[Auth] User doc not found, setting user to null');
          setUser(null);
        }
      } else {
        console.log('[Auth] No firebase user, setting user to null');
        setUser(null);
      }

      console.log('[Auth] Setting loading to false');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 회원가입
  async function register(
    email: string,
    password: string,
    name: string,
    role: 'student' | 'parent'
  ) {
    try {
      console.log('[Register] Starting registration for:', email, role);
      setError(null);
      setLoading(true);
      authOperationRef.current = 'registering';

      // Firebase Auth 회원가입
      console.log('[Register] Creating Firebase Auth user...');
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;
      console.log('[Register] Firebase Auth user created:', uid);

      // 학생인 경우 가족 코드 생성 (부모는 null)
      const familyCode = role === 'student' ? generateFamilyCode() : null;

      // Firestore에 사용자 정보 저장
      const userData = {
        email,
        name,
        role,
        familyCode,
        linkedFamilyCode: null,
        createdAt: new Date(),
      };

      console.log('[Register] Saving user to Firestore...');
      await setDoc(doc(db, 'users', uid), userData);
      console.log('[Register] User saved to Firestore');

      // 학생인 경우 잔액 문서도 생성
      if (role === 'student') {
        console.log('[Register] Creating balance doc...');
        await setDoc(doc(db, 'balances', uid), {
          currentBalance: 0,
          lastUpdated: new Date(),
        });
        console.log('[Register] Balance doc created');
      }

      // 회원가입 완료 후 사용자 상태 설정
      console.log('[Register] Setting user state...');
      const newUser: User = {
        id: uid,
        email,
        name,
        role,
        familyCode,
        createdAt: new Date(),
      };
      setUser(newUser);
      setLoading(false);
      console.log('[Register] User state set, loading false');

      // 플래그 해제 (약간의 지연 후)
      setTimeout(() => {
        authOperationRef.current = 'none';
        console.log('[Register] Auth operation reset to none');
      }, 100);

    } catch (err: any) {
      authOperationRef.current = 'none';
      console.error('[Register] Error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('이미 사용 중인 이메일입니다');
      } else if (err.code === 'auth/weak-password') {
        setError('비밀번호는 6자 이상이어야 합니다');
      } else if (err.code === 'auth/invalid-email') {
        setError('올바른 이메일 형식이 아닙니다');
      } else {
        setError('회원가입에 실패했습니다');
      }
      setLoading(false);
      throw err;
    }
  }

  // 로그인
  async function login(email: string, password: string) {
    try {
      console.log('[Login] Starting login for:', email);
      setError(null);
      setLoading(true);
      authOperationRef.current = 'logging_in';

      const credential = await signInWithEmailAndPassword(auth, email, password);
      console.log('[Login] Firebase Auth success:', credential.user.uid);

      // Firestore에서 사용자 정보 가져오기
      const userData = await fetchUserFromFirestore(credential.user.uid, credential.user.email || '');

      if (userData) {
        console.log('[Login] User data fetched:', userData.name);
        setUser(userData);
        setLoading(false);

        // 플래그 해제 (약간의 지연 후)
        setTimeout(() => {
          authOperationRef.current = 'none';
          console.log('[Login] Auth operation reset to none');
        }, 100);
      } else {
        throw new Error('User document not found');
      }
    } catch (err: any) {
      authOperationRef.current = 'none';
      console.error('[Login] Error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('이메일 또는 비밀번호가 올바르지 않습니다');
      } else if (err.code === 'auth/invalid-email') {
        setError('올바른 이메일 형식이 아닙니다');
      } else if (err.code === 'auth/invalid-credential') {
        setError('이메일 또는 비밀번호가 올바르지 않습니다');
      } else {
        setError('로그인에 실패했습니다');
      }
      setLoading(false);
      throw err;
    }
  }

  // 로그아웃
  async function logout() {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
      setError('로그아웃에 실패했습니다');
      throw err;
    }
  }

  // 부모가 학생과 연결
  async function linkToStudent(familyCode: string) {
    if (!user || user.role !== 'parent') {
      setError('부모 계정으로 로그인해주세요');
      return;
    }

    try {
      setError(null);
      
      // 해당 가족 코드를 가진 학생 찾기
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('familyCode', '==', familyCode), where('role', '==', 'student'));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('해당 가족 코드를 가진 학생을 찾을 수 없습니다');
        return;
      }
      
      // 부모 계정에 linkedFamilyCode 저장
      await updateDoc(doc(db, 'users', user.id), {
        linkedFamilyCode: familyCode,
      });
      
      setUser({
        ...user,
        linkedFamilyCode: familyCode,
      });
    } catch (err) {
      console.error('Link error:', err);
      setError('학생 연결에 실패했습니다');
      throw err;
    }
  }

  // 연결된 학생 정보 가져오기
  async function getLinkedStudentInfo(): Promise<{ name: string; balance: number } | null> {
    if (!user || user.role !== 'parent' || !user.linkedFamilyCode) {
      return null;
    }

    try {
      // 가족 코드로 학생 찾기
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('familyCode', '==', user.linkedFamilyCode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data();
      
      // 학생 잔액 가져오기
      const balanceDoc = await getDoc(doc(db, 'balances', studentDoc.id));
      const balance = balanceDoc.exists() ? balanceDoc.data().currentBalance : 0;
      
      return {
        name: studentData.name,
        balance,
      };
    } catch (err) {
      console.error('Get linked student error:', err);
      return null;
    }
  }

  // 사용자 이름 업데이트
  async function updateUserName(newName: string): Promise<void> {
    if (!user) {
      setError('로그인이 필요합니다');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.id), {
        name: newName,
      });

      setUser({
        ...user,
        name: newName,
      });
    } catch (err) {
      console.error('Update name error:', err);
      setError('이름 변경에 실패했습니다');
      throw err;
    }
  }

  // 회원 탈퇴
  async function deleteAccount(): Promise<void> {
    if (!user || !firebaseUser) {
      setError('로그인이 필요합니다');
      return;
    }

    try {
      const userId = user.id;

      // 1. Firestore에서 사용자 관련 데이터 삭제
      // 활동 데이터 삭제
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('userId', '==', userId)
      );
      const activitiesSnapshot = await getDocs(activitiesQuery);
      for (const actDoc of activitiesSnapshot.docs) {
        await deleteDoc(doc(db, 'activities', actDoc.id));
      }

      // 잔액 데이터 삭제
      await deleteDoc(doc(db, 'balances', userId));

      // 사용자 문서 삭제
      await deleteDoc(doc(db, 'users', userId));

      // 2. Firebase Auth에서 사용자 삭제
      await deleteUser(firebaseUser);

      // 3. 로컬 상태 초기화
      setUser(null);
    } catch (err: any) {
      console.error('Delete account error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('보안을 위해 다시 로그인 후 탈퇴해주세요');
      } else {
        setError('회원 탈퇴에 실패했습니다');
      }
      throw err;
    }
  }

  function clearError() {
    setError(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        error,
        register,
        login,
        logout,
        linkToStudent,
        getLinkedStudentInfo,
        updateUserName,
        deleteAccount,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { Subject, DEFAULT_SUBJECTS } from '../types';

interface SubjectContextType {
  subjects: Subject[];
  addSubject: (name: string, emoji: string) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  isLoading: boolean;
}

const SubjectContext = createContext<SubjectContextType | undefined>(undefined);

export function SubjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [customSubjects, setCustomSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Firestore에서 커스텀 과목 구독
  useEffect(() => {
    if (!user) {
      setCustomSubjects([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const subjectsRef = collection(db, 'subjects');
    const subjectsQuery = query(
      subjectsRef,
      where('userId', '==', user.id)
    );

    const unsubscribe = onSnapshot(subjectsQuery, (snapshot) => {
      const loaded: Subject[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          emoji: data.emoji,
          isDefault: false,
        };
      });
      setCustomSubjects(loaded);
      setIsLoading(false);
    }, (error) => {
      console.error('Subjects subscription error:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 기본 과목 + 커스텀 과목 합치기
  const subjects = [...DEFAULT_SUBJECTS, ...customSubjects];

  // 과목 추가
  async function addSubject(name: string, emoji: string) {
    if (!user) throw new Error('로그인이 필요합니다');

    // 중복 체크
    const exists = subjects.some(s => s.name === name);
    if (exists) {
      throw new Error('이미 존재하는 과목입니다');
    }

    await addDoc(collection(db, 'subjects'), {
      userId: user.id,
      name,
      emoji,
      createdAt: new Date(),
    });
  }

  // 과목 삭제 (커스텀 과목만)
  async function deleteSubject(id: string) {
    if (!user) throw new Error('로그인이 필요합니다');

    // 기본 과목은 삭제 불가
    const isDefault = DEFAULT_SUBJECTS.some(s => s.id === id);
    if (isDefault) {
      throw new Error('기본 과목은 삭제할 수 없습니다');
    }

    await deleteDoc(doc(db, 'subjects', id));
  }

  return (
    <SubjectContext.Provider
      value={{
        subjects,
        addSubject,
        deleteSubject,
        isLoading,
      }}
    >
      {children}
    </SubjectContext.Provider>
  );
}

export function useSubjects() {
  const context = useContext(SubjectContext);
  if (!context) {
    throw new Error('useSubjects must be used within a SubjectProvider');
  }
  return context;
}

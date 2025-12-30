import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ActivityProvider } from './src/contexts/ActivityContext';
import { ScheduleProvider } from './src/contexts/ScheduleContext';
import { SubjectProvider } from './src/contexts/SubjectContext';

// 학생 화면
import HomeScreen from './src/screens/student/HomeScreen';
import RecordScreen from './src/screens/student/RecordScreen';
import HistoryScreen from './src/screens/student/HistoryScreen';
import ScheduleScreen from './src/screens/student/ScheduleScreen';
import SettingsScreen from './src/screens/student/SettingsScreen';

// 부모 화면
import ParentDashboardScreen from './src/screens/parent/ParentDashboardScreen';
import ApprovalScreen from './src/screens/parent/ApprovalScreen';
import ParentHistoryScreen from './src/screens/parent/ParentHistoryScreen';
import PenaltyScreen from './src/screens/parent/PenaltyScreen';

// 인증 화면
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';

import { COLORS, SHADOWS, BORDER_RADIUS } from './src/constants/theme';

const StudentTab = createBottomTabNavigator();
const ParentTab = createBottomTabNavigator();

function TabBarIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={[styles.tabIconContainer, focused && styles.tabIconContainerActive]}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{emoji}</Text>
    </View>
  );
}

// 학생용 탭 네비게이터
function StudentNavigator() {
  return (
    <SubjectProvider>
      <ScheduleProvider>
        <ActivityProvider>
          <StudentTab.Navigator
          screenOptions={{
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.textSecondary,
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '600',
              marginTop: -4,
            },
            tabBarStyle: {
              backgroundColor: COLORS.card,
              borderTopWidth: 0,
              height: 70,
              paddingBottom: 8,
              paddingTop: 8,
              ...SHADOWS.medium,
            },
            headerStyle: {
              backgroundColor: COLORS.background,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
            },
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 20,
              color: COLORS.textPrimary,
            },
          }}
        >
          <StudentTab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: '홈',
              headerTitle: '🐷 아달이 시간 저금통',
              tabBarIcon: ({ focused }) => (
                <TabBarIcon emoji="🏠" focused={focused} />
              ),
            }}
          />
          <StudentTab.Screen
            name="Record"
            component={RecordScreen}
            options={{
              title: '기록',
              headerTitle: '✏️ 활동 기록하기',
              tabBarIcon: ({ focused }) => (
                <TabBarIcon emoji="✏️" focused={focused} />
              ),
            }}
          />
          <StudentTab.Screen
            name="History"
            component={HistoryScreen}
            options={{
              title: '히스토리',
              headerTitle: '📅 기록 보기',
              tabBarIcon: ({ focused }) => (
                <TabBarIcon emoji="📅" focused={focused} />
              ),
            }}
          />
          <StudentTab.Screen
            name="Schedule"
            component={ScheduleScreen}
            options={{
              title: '스케줄',
              headerTitle: '🗓️ 스케줄 설정',
              tabBarIcon: ({ focused }) => (
                <TabBarIcon emoji="🗓️" focused={focused} />
              ),
            }}
          />
          <StudentTab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: '설정',
              headerTitle: '⚙️ 설정',
              tabBarIcon: ({ focused }) => (
                <TabBarIcon emoji="⚙️" focused={focused} />
              ),
            }}
          />
          </StudentTab.Navigator>
        </ActivityProvider>
      </ScheduleProvider>
    </SubjectProvider>
  );
}

// 부모용 탭 네비게이터
function ParentNavigator() {
  return (
    <ParentTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: -4,
        },
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 8,
          paddingTop: 8,
          ...SHADOWS.medium,
        },
        headerStyle: {
          backgroundColor: COLORS.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
          color: COLORS.textPrimary,
        },
      }}
    >
      <ParentTab.Screen
        name="Dashboard"
        component={ParentDashboardScreen}
        options={{
          title: '대시보드',
          headerTitle: '👨‍👩‍👦 부모님 모드',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon emoji="📊" focused={focused} />
          ),
        }}
      />
      <ParentTab.Screen
        name="Approval"
        component={ApprovalScreen}
        options={{
          title: '승인',
          headerTitle: '⏳ 승인 대기',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon emoji="✅" focused={focused} />
          ),
        }}
      />
      <ParentTab.Screen
        name="History"
        component={ParentHistoryScreen}
        options={{
          title: '기록',
          headerTitle: '📅 기록 조회',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon emoji="📅" focused={focused} />
          ),
        }}
      />
      <ParentTab.Screen
        name="Penalty"
        component={PenaltyScreen}
        options={{
          title: '벌금',
          headerTitle: '⚠️ 벌금 부과',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon emoji="⚠️" focused={focused} />
          ),
        }}
      />
      <ParentTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: '설정',
          headerTitle: '⚙️ 설정',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon emoji="⚙️" focused={focused} />
          ),
        }}
      />
    </ParentTab.Navigator>
  );
}

// 인증 화면
function AuthScreens() {
  const [showRegister, setShowRegister] = useState(false);

  if (showRegister) {
    return <RegisterScreen onSwitchToLogin={() => setShowRegister(false)} />;
  }
  return <LoginScreen onSwitchToRegister={() => setShowRegister(true)} />;
}

// 로딩 화면
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingEmoji}>🐷</Text>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>불러오는 중...</Text>
    </View>
  );
}

// 메인 앱 컨텐츠
function AppContent() {
  const { user, loading } = useAuth();

  console.log('[AppContent] user:', user?.email, 'role:', user?.role, 'loading:', loading);

  if (loading) {
    console.log('[AppContent] Showing LoadingScreen');
    return <LoadingScreen />;
  }

  if (!user) {
    console.log('[AppContent] No user, showing AuthScreens');
    return <AuthScreens />;
  }

  // 역할에 따라 다른 네비게이터 표시
  if (user.role === 'parent') {
    console.log('[AppContent] Showing ParentNavigator');
    return <ParentNavigator />;
  }

  console.log('[AppContent] Showing StudentNavigator');
  return <StudentNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppContent />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconContainerActive: {
    backgroundColor: `${COLORS.primary}15`,
  },
  tabIcon: {
    fontSize: 22,
  },
  tabIconActive: {
    fontSize: 26,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});

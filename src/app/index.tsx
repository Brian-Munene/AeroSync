
import { auth, db } from '@/lib/firebase';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ApprovalsScreen from './approvals';
import BaggageScreen from './baggage';
import CrewScreen from './crew';
import DelayRiskScreen from './delay-risk';
import HandlerDashboard from './handler-dashboard';

type DashboardScreen =
  | 'dashboard'
  | 'approvals'
  | 'baggage'
  | 'crew'
  | 'delay-risk';

const NAVY = '#163B65';
const BLUE = '#2878C8';
const BG = '#F4F6FA';
const MUTED = '#64748B';

export default function HomeScreen() {
  const [role, setRole] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [screen, setScreen] = useState<DashboardScreen>('dashboard');

  const [pendingCount, setPendingCount] = useState(0);
  const [baggageCount, setBaggageCount] = useState(0);
  const [crewCount, setCrewCount] = useState(0);

  // Read only the signed-in user's profile.
  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setRole('');
      setProfileLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        setRole(snapshot.exists() ? snapshot.data().role ?? '' : '');
        setProfileLoading(false);
      },
      (error) => {
        console.error('Could not load user profile:', error);
        setRole('');
        setProfileLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // Live counts for the supervisor dashboard.
  useEffect(() => {
    if (role !== 'supervisor') {
      return;
    }

    const unsubscribePending = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'pending')),
      (snapshot) => setPendingCount(snapshot.size),
      (error) => console.error('Could not load pending count:', error)
    );

    const unsubscribeCrew = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'handler')),
      (snapshot) => setCrewCount(snapshot.size),
      (error) => console.error('Could not load crew count:', error)
    );

    const unsubscribeBaggage = onSnapshot(
      collection(db, 'BaggageRecords'),
      (snapshot) => setBaggageCount(snapshot.size),
      (error) => console.error('Could not load baggage count:', error)
    );

    return () => {
      unsubscribePending();
      unsubscribeCrew();
      unsubscribeBaggage();
    };
  }, [role]);

  function goBack() {
    setScreen('dashboard');
  }

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={styles.loadingText}>Loading AeroSync...</Text>
      </SafeAreaView>
    );
  }

  // Supervisor-only screens.
  if (role === 'supervisor') {
    if (screen === 'approvals') {
      return <ApprovalsScreen onBack={goBack} />;
    }

    if (screen === 'baggage') {
      return <BaggageScreen onBack={goBack} />;
    }

    if (screen === 'crew') {
      return <CrewScreen onBack={goBack} />;
    }

    if (screen === 'delay-risk') {
      return <DelayRiskScreen onBack={goBack} />;
    }
  }

  // Approved handler dashboard.
  if (role === 'handler') {
    return <HandlerDashboard />;
  }

  // Pending or unrecognized account.
  if (role !== 'supervisor') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>AEROSYNC</Text>
          <Text style={styles.heading}>Account pending approval</Text>
          <Text style={styles.subtitle}>
            Your account has not been approved for operational access yet.
            Please contact your supervisor.
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Your account</Text>
            <Text style={styles.muted}>
              {auth.currentUser?.displayName ||
                auth.currentUser?.email ||
                'Signed-in user'}
            </Text>
            <Text style={styles.muted}>
              Account status: {role || 'Not available'}
            </Text>
          </View>

          <Text style={styles.footer}>
            AeroSync · Ground operations
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Supervisor dashboard.
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>AEROSYNC · SUPERVISOR</Text>
        <Text style={styles.heading}>Operations dashboard</Text>
        <Text style={styles.subtitle}>
          Monitor your ground crew, baggage operations and staff approvals.
        </Text>

        <View style={styles.welcomeCard}>
          <View style={styles.welcomeTop}>
            <View style={styles.welcomeText}>
              <Text style={styles.welcomeEyebrow}>
                SUPERVISOR WORKSPACE
              </Text>
              <Text style={styles.welcomeTitle}>Good to see you</Text>
              <Text style={styles.welcomeSubtitle}>
                Your ground operations at a glance.
              </Text>
            </View>
            <Text style={styles.welcomeIcon}>✈</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Operations overview</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>♙</Text>
            <Text style={styles.statNumber}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending approvals</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>▣</Text>
            <Text style={styles.statNumber}>{baggageCount}</Text>
            <Text style={styles.statLabel}>Baggage records</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>♧</Text>
            <Text style={styles.statNumber}>{crewCount}</Text>
            <Text style={styles.statLabel}>Approved handlers</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>!</Text>
            <Text style={styles.statNumber}>—</Text>
            <Text style={styles.statLabel}>Open incidents</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Manage operations</Text>

        <Pressable
          style={styles.actionCard}
          onPress={() => setScreen('approvals')}
        >
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>✓</Text>
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.cardTitle}>Staff approvals</Text>
            <Text style={styles.muted}>
              Review and approve eligible handler applications.
            </Text>
          </View>
          <View style={styles.actionRight}>
            <Text style={styles.countBadge}>{pendingCount}</Text>
            <Text style={styles.arrow}>›</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.actionCard}
          onPress={() => setScreen('baggage')}
        >
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>▣</Text>
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.cardTitle}>Baggage operations</Text>
            <Text style={styles.muted}>
              View existing baggage records, flights and statuses.
            </Text>
          </View>
          <View style={styles.actionRight}>
            <Text style={styles.countBadge}>{baggageCount}</Text>
            <Text style={styles.arrow}>›</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.actionCard}
          onPress={() => setScreen('crew')}
        >
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>♧</Text>
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.cardTitle}>Crew coordination</Text>
            <Text style={styles.muted}>
              View handlers and manage flight and shift assignments.
            </Text>
          </View>
          <View style={styles.actionRight}>
            <Text style={styles.countBadge}>{crewCount}</Text>
            <Text style={styles.arrow}>›</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.actionCard}
          onPress={() => setScreen('delay-risk')}
        >
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>!</Text>
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.cardTitle}>Delay-risk monitoring</Text>
            <Text style={styles.muted}>
              Assess operational warning indicators and estimated delay risk.
            </Text>
          </View>
          <View style={styles.actionRight}>
            <Text style={styles.arrow}>›</Text>
          </View>
        </Pressable>

        <View style={styles.accountCard}>
          <Text style={styles.cardTitle}>Signed in as supervisor</Text>
          <Text style={styles.muted}>
            {auth.currentUser?.email || 'Supervisor account'}
          </Text>
        </View>

        <Text style={styles.footer}>
          AeroSync · Ground crew coordination
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: NAVY,
    fontSize: 14,
  },
  content: {
    padding: 22,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    gap: 12,
  },
  eyebrow: {
    color: BLUE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  heading: {
    color: NAVY,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  welcomeCard: {
    backgroundColor: NAVY,
    borderRadius: 20,
    padding: 22,
    marginTop: 6,
    marginBottom: 10,
  },
  welcomeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  welcomeText: {
    flex: 1,
    gap: 7,
  },
  welcomeEyebrow: {
    color: '#DCEBFA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  welcomeSubtitle: {
    color: '#DCEBFA',
    fontSize: 13,
    lineHeight: 19,
  },
  welcomeIcon: {
    color: '#FFFFFF',
    fontSize: 40,
  },
  sectionTitle: {
    color: NAVY,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: 130,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    gap: 5,
  },
  statIcon: {
    color: BLUE,
    fontSize: 20,
    fontWeight: '800',
  },
  statNumber: {
    color: NAVY,
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#EAF2FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconText: {
    color: BLUE,
    fontSize: 23,
    fontWeight: '800',
  },
  actionInfo: {
    flex: 1,
    gap: 5,
  },
  cardTitle: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '800',
  },
  muted: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
  },
  actionRight: {
    alignItems: 'center',
    gap: 4,
  },
  countBadge: {
    overflow: 'hidden',
    backgroundColor: '#EAF2FC',
    color: NAVY,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
  arrow: {
    color: BLUE,
    fontSize: 25,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 18,
    gap: 8,
    marginTop: 4,
  },
  footer: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    marginTop: 20,
  },
});


import { auth, db } from '@/lib/firebase';
import { useRouter } from 'expo-router';
import {
    collection,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Applicant = {
  uid: string;
  displayName?: string;
  email?: string;
  role: string;
  requestedRole?: string;
};

const NAVY = '#163B65';
const BLUE = '#2878C8';
const BG = '#F4F6FA';
const MUTED = '#64748B';

export default function ApprovalsScreen({
  onBack,
}: {
  onBack?: () => void;
}) {
  const router = useRouter();
  const currentUser = auth.currentUser;

  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvingUid, setApprovingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setError('Please sign in to continue.');
      setLoading(false);
      return;
    }

    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeApplicants: (() => void) | undefined;
    let active = true;

    unsubscribeProfile = onSnapshot(
      doc(db, 'users', currentUser.uid),
      (profileSnapshot) => {
        if (!active) return;

        const role = profileSnapshot.exists()
          ? profileSnapshot.data().role
          : null;

        if (role !== 'supervisor') {
          unsubscribeApplicants?.();
          setApplicants([]);
          setError('Only authorized supervisors can access approvals.');
          setLoading(false);
          return;
        }

        setError('');

        if (!unsubscribeApplicants) {
          const pendingQuery = query(
            collection(db, 'users'),
            where('role', '==', 'pending')
          );

          unsubscribeApplicants = onSnapshot(
            pendingQuery,
            (snapshot) => {
              if (!active) return;

              setApplicants(
                snapshot.docs
                  .map((item) => ({
                    uid: item.id,
                    ...(item.data() as Omit<Applicant, 'uid'>),
                  }))
                  .filter((item) => item.uid !== currentUser.uid)
                  .sort((a, b) =>
                    (a.displayName ?? '').localeCompare(
                      b.displayName ?? ''
                    )
                  )
              );

              setLoading(false);
            },
            (snapshotError) => {
              console.error(
                'Could not load pending applicants:',
                snapshotError
              );
              setError(
                'Could not load applications. Check your connection.'
              );
              setLoading(false);
            }
          );
        }
      },
      (profileError) => {
        console.error(
          'Could not verify supervisor profile:',
          profileError
        );
        setError('Your supervisor profile could not be verified.');
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribeProfile?.();
      unsubscribeApplicants?.();
    };
  }, [currentUser?.uid]);

  function showMessage(title: string, message: string) {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  async function handleApprove(applicant: Applicant) {
    if (!currentUser || approvingUid) return;

    if (applicant.requestedRole !== 'handler') {
      showMessage(
        'Supervisor authorization required',
        'This applicant did not request a handler role. Supervisor access must be authorized separately.'
      );
      return;
    }

    const applicantName =
      applicant.displayName || applicant.email || 'this applicant';

    const confirmApproval = async () => {
      setApprovingUid(applicant.uid);

      try {
        await updateDoc(doc(db, 'users', applicant.uid), {
          role: 'handler',
          approvedBy: currentUser.uid,
          approvedAt: serverTimestamp(),
        });

        showMessage(
          'Handler approved',
          `${applicantName} can now access the handler dashboard.`
        );
      } catch (approvalError) {
        console.error('Could not approve handler:', approvalError);

        showMessage(
          'Approval failed',
          'The handler could not be approved. Check your connection and Firebase permissions, then try again.'
        );
      } finally {
        setApprovingUid(null);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Are you sure you want to approve ${applicantName} as a baggage handler?`
      );

      if (confirmed) {
        await confirmApproval();
      }
    } else {
      Alert.alert(
        'Confirm handler approval',
        `Are you sure you want to approve ${applicantName} as a baggage handler?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Approve',
            onPress: () => {
              void confirmApproval();
            },
          },
        ]
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back to dashboard</Text>
        </Pressable>

        <Text style={styles.eyebrow}>STAFF MANAGEMENT</Text>
        <Text style={styles.heading}>Handler approvals</Text>
        <Text style={styles.subtitle}>
          Review new staff registrations and approve eligible handlers.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pending applications</Text>
          <Text style={styles.summaryNumber}>
            {loading ? '—' : applicants.length}
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={NAVY} />
            <Text style={styles.mutedText}>Loading applications…</Text>
          </View>
        ) : error ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : applicants.length === 0 ? (
          <View style={styles.messageCard}>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.mutedText}>
              There are no pending applications right now.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {applicants.map((applicant) => {
              const isHandlerRequest =
                applicant.requestedRole === 'handler';

              return (
                <View
                  key={applicant.uid}
                  style={styles.applicantCard}
                >
                  <View style={styles.applicantHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(applicant.displayName ||
                          applicant.email ||
                          '?')
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.applicantInfo}>
                      <Text style={styles.applicantName}>
                        {applicant.displayName || 'Name not provided'}
                      </Text>
                      <Text style={styles.email}>
                        {applicant.email || 'Email not available'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.roleRow}>
                    <Text style={styles.fieldLabel}>
                      Requested role
                    </Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>
                        {applicant.requestedRole || 'Not specified'}
                      </Text>
                    </View>
                  </View>

                  {isHandlerRequest ? (
                    <Pressable
                      style={[
                        styles.approveButton,
                        approvingUid !== null && styles.disabled,
                      ]}
                      onPress={() => handleApprove(applicant)}
                      disabled={approvingUid !== null}
                    >
                      {approvingUid === applicant.uid ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.approveButtonText}>
                          Approve handler
                        </Text>
                      )}
                    </Pressable>
                  ) : (
                    <View style={styles.warningBox}>
                      <Text style={styles.warningText}>
                        Requires separate authorization. Cannot be
                        approved as a handler.
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    padding: 22,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 850,
    alignSelf: 'center',
    gap: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  backText: {
    color: BLUE,
    fontWeight: '700',
    fontSize: 14,
  },
  eyebrow: {
    color: BLUE,
    fontSize: 11,
    fontWeight: '700',
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
  summaryCard: {
    backgroundColor: NAVY,
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#DCEBFA',
    fontSize: 14,
  },
  summaryNumber: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    marginTop: 5,
  },
  list: {
    gap: 14,
  },
  applicantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  applicantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EAF2FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: NAVY,
    fontWeight: '800',
    fontSize: 20,
  },
  applicantInfo: {
    flex: 1,
    gap: 4,
  },
  applicantName: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '700',
  },
  email: {
    color: MUTED,
    fontSize: 13,
  },
  roleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  fieldLabel: {
    color: MUTED,
    fontSize: 13,
  },
  roleBadge: {
    backgroundColor: '#FFF4D6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  roleBadgeText: {
    color: '#825A00',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  approveButton: {
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.6,
  },
  warningBox: {
    backgroundColor: '#FFF4D6',
    padding: 12,
    borderRadius: 10,
  },
  warningText: {
    color: '#825A00',
    fontSize: 12,
    lineHeight: 18,
  },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: '700',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  mutedText: {
    color: MUTED,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});

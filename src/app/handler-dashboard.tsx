
import { auth, db } from '@/lib/firebase';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
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

type Assignment = {
  id: string;
  flightNumber: string;
  shiftDate: string;
  shiftTime: string;
  activity: string;
  status: string;
  handlerName: string;
  checkInAt?: Timestamp | null;
  checkOutAt?: Timestamp | null;
  attendanceStatus?: string;
};

const NAVY = '#163B65';
const BLUE = '#2878C8';
const BG = '#F4F6FA';
const MUTED = '#64748B';
const GREEN = '#15803D';
const BORDER = '#E2E8F0';

function formatTimestamp(value?: Timestamp | null) {
  if (!value || typeof value.toDate !== 'function') {
    return 'Not recorded';
  }

  return value.toDate().toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDuration(
  checkInAt?: Timestamp | null,
  checkOutAt?: Timestamp | null
) {
  if (!checkInAt || !checkOutAt) {
    return 'Unavailable';
  }

  const milliseconds =
    checkOutAt.toMillis() - checkInAt.toMillis();

  if (milliseconds < 0) {
    return 'Unavailable';
  }

  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isTodayShift(shiftDate: string) {
  const value = shiftDate.trim();
  const today = getLocalDateKey(new Date());

  // ISO-style dates: YYYY-MM-DD
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');

    return `${year}-${month}-${day}` === today;
  }

  // Kenyan-style dates: DD/MM/YYYY or DD-MM-YYYY
  const localMatch = value.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
  );

  if (localMatch) {
    const day = localMatch[1].padStart(2, '0');
    const month = localMatch[2].padStart(2, '0');
    const year = localMatch[3];

    return `${year}-${month}-${day}` === today;
  }

  // Fallback for other date formats JavaScript can parse.
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return getLocalDateKey(parsed) === today;
}

function getStatusColors(status: string) {
  switch (status) {
    case 'Completed':
      return {
        backgroundColor: '#DCFCE7',
        color: '#166534',
      };

    case 'In Progress':
      return {
        backgroundColor: '#FEF3C7',
        color: '#92400E',
      };

    default:
      return {
        backgroundColor: '#EAF2FC',
        color: BLUE,
      };
  }
}

export default function HandlerDashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setError('Please sign in to view your assignments.');
      setLoading(false);
      return;
    }

    const myAssignmentsQuery = query(
      collection(db, 'CrewAssignments'),
      where('handlerUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      myAssignmentsQuery,
      (snapshot) => {
        const results: Assignment[] = snapshot.docs.map((item) => {
          const data = item.data();

          return {
            id: item.id,
            flightNumber: data.flightNumber ?? 'Flight not specified',
            shiftDate: data.shiftDate ?? 'Date not specified',
            shiftTime: data.shiftTime ?? 'Time not specified',
            activity: data.activity ?? 'Activity not specified',
            status: data.status ?? 'Assigned',
            handlerName: data.handlerName ?? 'Handler',
            checkInAt: data.checkInAt ?? null,
            checkOutAt: data.checkOutAt ?? null,
            attendanceStatus: data.attendanceStatus ?? 'Not Checked In',
          };
        });

        results.sort((a, b) =>
          `${a.shiftDate} ${a.shiftTime}`.localeCompare(
            `${b.shiftDate} ${b.shiftTime}`
          )
        );

        setAssignments(results);
        setError('');
        setLoading(false);
      },
      (err) => {
        console.error('Could not load handler assignments:', err);
        setError(
          'Unable to load your assignments. Check your connection and Firestore permissions.'
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  async function updateTaskStatus(
    assignment: Assignment,
    newStatus: 'In Progress' | 'Completed'
  ) {
    const user = auth.currentUser;

    if (!user) {
      setUpdateError('Please sign in again before updating a task.');
      return;
    }

    if (updatingId) return;

    setUpdatingId(assignment.id);
    setUpdateError('');

    try {
      await updateDoc(doc(db, 'CrewAssignments', assignment.id), {
        status: newStatus,
      });
    } catch (err) {
      console.error('Could not update task status:', err);
      setUpdateError(
        'Could not update this task. Please check your connection and Firestore Rules.'
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateAttendance(
    assignment: Assignment,
    action: 'checkIn' | 'checkOut'
  ) {
    const user = auth.currentUser;

    if (!user) {
      setUpdateError('Please sign in again before updating attendance.');
      return;
    }

    if (updatingId) return;

    if (
      action === 'checkIn' &&
      assignment.attendanceStatus !== 'Not Checked In'
    ) {
      setUpdateError('This shift has already been checked in.');
      return;
    }

    if (
      action === 'checkOut' &&
      assignment.attendanceStatus !== 'Checked In'
    ) {
      setUpdateError('Check in before checking out.');
      return;
    }

    setUpdatingId(assignment.id);
    setUpdateError('');

    try {
      const attendanceUpdate =
        action === 'checkIn'
          ? {
              checkInAt: serverTimestamp(),
              attendanceStatus: 'Checked In',
            }
          : {
              checkOutAt: serverTimestamp(),
              attendanceStatus: 'Checked Out',
            };

      await updateDoc(
        doc(db, 'CrewAssignments', assignment.id),
        attendanceUpdate
      );
    } catch (err) {
      console.error('Could not update attendance:', err);
      setUpdateError(
        'Attendance could not be saved. Check your connection and Firestore Rules.'
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function renderAssignmentCard(
    assignment: Assignment,
    featured = false
  ) {
    const isUpdating = updatingId === assignment.id;
    const attendanceStatus =
      assignment.attendanceStatus ?? 'Not Checked In';
    const statusColors = getStatusColors(assignment.status);

    return (
      <View
        key={assignment.id}
        style={[
          styles.assignmentCard,
          featured && styles.featuredAssignmentCard,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.flightInfo}>
            <Text style={styles.flightLabel}>FLIGHT</Text>
            <Text style={styles.flightNumber}>
              {assignment.flightNumber}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColors.backgroundColor },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: statusColors.color },
              ]}
            >
              {assignment.status}
            </Text>
          </View>
        </View>

        <Text style={styles.activity}>{assignment.activity}</Text>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Shift date</Text>
            <Text style={styles.detailValue}>
              {assignment.shiftDate}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Shift time</Text>
            <Text style={styles.detailValue}>
              {assignment.shiftTime}
            </Text>
          </View>
        </View>

        <View style={styles.attendanceCard}>
          <View style={styles.attendanceHeader}>
            <Text style={styles.attendanceHeading}>Shift attendance</Text>

            <View
              style={[
                styles.attendanceDot,
                attendanceStatus === 'Checked In' &&
                  styles.checkedInDot,
                attendanceStatus === 'Checked Out' &&
                  styles.checkedOutDot,
              ]}
            />
          </View>

          <Text
            style={[
              styles.attendanceStatus,
              attendanceStatus === 'Checked In' &&
                styles.checkedInText,
              attendanceStatus === 'Checked Out' &&
                styles.checkedOutText,
            ]}
          >
            {attendanceStatus}
          </Text>

          <Text style={styles.attendanceDetail}>
            Check-in: {formatTimestamp(assignment.checkInAt)}
          </Text>

          {(attendanceStatus === 'Checked In' ||
            attendanceStatus === 'Checked Out') && (
            <Text style={styles.attendanceDetail}>
              Check-out: {formatTimestamp(assignment.checkOutAt)}
            </Text>
          )}

          {attendanceStatus === 'Checked Out' && (
            <View style={styles.durationRow}>
              <Text style={styles.durationLabel}>Total shift duration</Text>
              <Text style={styles.durationValue}>
                {formatDuration(
                  assignment.checkInAt,
                  assignment.checkOutAt
                )}
              </Text>
            </View>
          )}

          {attendanceStatus === 'Not Checked In' && (
            <Pressable
              accessibilityRole="button"
              disabled={!!updatingId}
              onPress={() => updateAttendance(assignment, 'checkIn')}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                !!updatingId && styles.buttonDisabled,
              ]}
            >
              {isUpdating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Check in</Text>
              )}
            </Pressable>
          )}

          {attendanceStatus === 'Checked In' && (
            <Pressable
              accessibilityRole="button"
              disabled={!!updatingId}
              onPress={() => updateAttendance(assignment, 'checkOut')}
              style={({ pressed }) => [
                styles.successButton,
                pressed && styles.buttonPressed,
                !!updatingId && styles.buttonDisabled,
              ]}
            >
              {isUpdating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Check out</Text>
              )}
            </Pressable>
          )}

          {attendanceStatus === 'Checked Out' && (
            <View style={styles.completedBanner}>
              <Text style={styles.completedText}>
                ✓ Shift checked out
              </Text>
            </View>
          )}
        </View>

        <View style={styles.taskSection}>
          <Text style={styles.taskHeading}>Task progress</Text>

          {assignment.status === 'Assigned' && (
            <Pressable
              accessibilityRole="button"
              disabled={!!updatingId}
              onPress={() =>
                updateTaskStatus(assignment, 'In Progress')
              }
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                !!updatingId && styles.buttonDisabled,
              ]}
            >
              {isUpdating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Start task</Text>
              )}
            </Pressable>
          )}

          {assignment.status === 'In Progress' && (
            <Pressable
              accessibilityRole="button"
              disabled={!!updatingId}
              onPress={() =>
                updateTaskStatus(assignment, 'Completed')
              }
              style={({ pressed }) => [
                styles.successButton,
                pressed && styles.buttonPressed,
                !!updatingId && styles.buttonDisabled,
              ]}
            >
              {isUpdating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Mark as completed</Text>
              )}
            </Pressable>
          )}

          {assignment.status === 'Completed' && (
            <View style={styles.completedBanner}>
              <Text style={styles.completedText}>
                ✓ Task completed
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  const todaysAssignments = assignments.filter((assignment) =>
    isTodayShift(assignment.shiftDate)
  );

  const todaysShift = todaysAssignments[0];

  const otherAssignments = todaysShift
    ? assignments.filter(
        (assignment) => assignment.id !== todaysShift.id
      )
    : assignments;

  const completedCount = assignments.filter(
    (assignment) => assignment.status === 'Completed'
  ).length;

  const inProgressCount = assignments.filter(
    (assignment) => assignment.status === 'In Progress'
  ).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topHeader}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>A</Text>
          </View>

          <View style={styles.brandTextContainer}>
            <Text style={styles.eyebrow}>AEROSYNC</Text>
            <Text style={styles.workspaceLabel}>HANDLER WORKSPACE</Text>
          </View>

          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>CREW</Text>
          </View>
        </View>

        <View style={styles.greetingSection}>
          <Text style={styles.heading}>My operations</Text>
          <Text style={styles.subtitle}>
            Your shifts, assignments and attendance in one place.
          </Text>
        </View>

        <View style={styles.overviewCard}>
          <View style={styles.overviewTop}>
            <View style={styles.overviewText}>
              <Text style={styles.overviewLabel}>MY ASSIGNMENTS</Text>
              <Text style={styles.overviewNumber}>
                {loading ? '—' : assignments.length}
              </Text>
              <Text style={styles.overviewHint}>
                Total assigned tasks
              </Text>
            </View>

            <View style={styles.planeIconContainer}>
              <Text style={styles.planeIcon}>✈</Text>
            </View>
          </View>

          <View style={styles.overviewDivider} />

          <View style={styles.overviewStats}>
            <View style={styles.overviewStat}>
              <Text style={styles.overviewStatNumber}>
                {loading ? '—' : inProgressCount}
              </Text>
              <Text style={styles.overviewStatLabel}>In progress</Text>
            </View>

            <View style={styles.overviewStatSeparator} />

            <View style={styles.overviewStat}>
              <Text style={styles.overviewStatNumber}>
                {loading ? '—' : completedCount}
              </Text>
              <Text style={styles.overviewStatLabel}>Completed</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.messageCard}>
            <ActivityIndicator size="large" color={BLUE} />
            <Text style={styles.muted}>Loading your operations...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.messageTitle}>Unable to load assignments</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Today's shift</Text>
                <Text style={styles.sectionSubtitle}>
                  Your priority assignment for today
                </Text>
              </View>

              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeText}>TODAY</Text>
              </View>
            </View>

            {todaysShift ? (
              renderAssignmentCard(todaysShift, true)
            ) : (
              <View style={styles.emptyShiftCard}>
                <View style={styles.emptyIconContainer}>
                  <Text style={styles.emptyIcon}>✈</Text>
                </View>

                <Text style={styles.emptyTitle}>
                  No shift scheduled today
                </Text>

                <Text style={styles.muted}>
                  You don't have an assignment dated today. Your other
                  assignments will appear below.
                </Text>
              </View>
            )}

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  Other assignments
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Your remaining assigned flights and shifts
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {otherAssignments.length}
                </Text>
              </View>
            </View>

            {otherAssignments.length === 0 ? (
              <View style={styles.messageCard}>
                <Text style={styles.emptyTitle}>
                  No other assignments
                </Text>
                <Text style={styles.muted}>
                  Any additional assignments from your supervisor will
                  appear here automatically.
                </Text>
              </View>
            ) : (
              <View style={styles.assignmentList}>
                {otherAssignments.map((assignment) =>
                  renderAssignmentCard(assignment)
                )}
              </View>
            )}
          </>
        )}

        {updateError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{updateError}</Text>
            <Pressable onPress={() => setUpdateError('')}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Attendance and task records</Text>
          <Text style={styles.muted}>
            Check-in and check-out record your shift attendance. Starting
            and completing a task updates its task status separately.
            Changes synchronize through Firebase.
          </Text>
        </View>

        <Text style={styles.footer}>
          AeroSync · Ground operations
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    gap: 16,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 4,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
  },
  brandTextContainer: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  workspaceLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  roleBadge: {
    backgroundColor: '#EAF2FC',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  roleBadgeText: {
    color: BLUE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  greetingSection: {
    gap: 5,
    marginTop: 4,
    marginBottom: 2,
  },
  heading: {
    color: NAVY,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
  },
  overviewCard: {
    backgroundColor: NAVY,
    borderRadius: 22,
    padding: 21,
    gap: 16,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overviewText: {
    gap: 5,
  },
  overviewLabel: {
    color: '#DCEBFA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  overviewNumber: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
  },
  overviewHint: {
    color: '#DCEBFA',
    fontSize: 12,
  },
  planeIconContainer: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#285780',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planeIcon: {
    color: '#FFFFFF',
    fontSize: 32,
  },
  overviewDivider: {
    height: 1,
    backgroundColor: '#456687',
  },
  overviewStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewStat: {
    flex: 1,
    gap: 4,
  },
  overviewStatNumber: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },
  overviewStatLabel: {
    color: '#DCEBFA',
    fontSize: 12,
  },
  overviewStatSeparator: {
    width: 1,
    height: 36,
    backgroundColor: '#456687',
    marginHorizontal: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 5,
  },
  sectionTitle: {
    color: NAVY,
    fontSize: 20,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  todayBadge: {
    backgroundColor: '#DCEBFA',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  todayBadgeText: {
    color: NAVY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  countBadge: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: '#EAF2FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '900',
  },
  assignmentList: {
    gap: 14,
  },
  assignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 17,
    gap: 14,
  },
  featuredAssignmentCard: {
    borderColor: '#C5D9F1',
    borderWidth: 1.5,
    padding: 19,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  flightInfo: {
    flex: 1,
    gap: 3,
  },
  flightLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  flightNumber: {
    color: NAVY,
    fontSize: 24,
    fontWeight: '900',
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  activity: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  detailsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 11,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailLabel: {
    color: MUTED,
    fontSize: 12,
  },
  detailValue: {
    color: NAVY,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  attendanceCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  attendanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attendanceHeading: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '800',
  },
  attendanceDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#94A3B8',
  },
  checkedInDot: {
    backgroundColor: BLUE,
  },
  checkedOutDot: {
    backgroundColor: GREEN,
  },
  attendanceStatus: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '800',
  },
  checkedInText: {
    color: BLUE,
  },
  checkedOutText: {
    color: GREEN,
  },
  attendanceDetail: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
  },
  durationRow: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 10,
    gap: 4,
  },
  durationLabel: {
    color: MUTED,
    fontSize: 11,
  },
  durationValue: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '900',
  },
  taskSection: {
    gap: 9,
  },
  taskHeading: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: BLUE,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  successButton: {
    backgroundColor: GREEN,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  completedBanner: {
    backgroundColor: '#DCFCE7',
    borderRadius: 11,
    padding: 12,
    alignItems: 'center',
  },
  completedText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyShiftCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 19,
    padding: 23,
    alignItems: 'center',
    gap: 11,
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#EAF2FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    color: BLUE,
    fontSize: 29,
  },
  emptyTitle: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  muted: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 13,
    padding: 15,
    gap: 8,
  },
  messageTitle: {
    color: '#991B1B',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  dismissText: {
    color: '#991B1B',
    fontWeight: '800',
    textAlign: 'center',
    padding: 5,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 15,
    padding: 17,
    gap: 8,
    marginTop: 3,
  },
  infoTitle: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '800',
  },
  footer: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    marginTop: 5,
  },
});

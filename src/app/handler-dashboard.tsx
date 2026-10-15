
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

    // Prevent duplicate actions using the latest assignment state.
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>AEROSYNC · HANDLER WORKSPACE</Text>
        <Text style={styles.heading}>My assignments</Text>
        <Text style={styles.subtitle}>
          View your shifts, record attendance and update your task progress.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>My assigned tasks</Text>
          <Text style={styles.summaryNumber}>
            {loading ? '—' : assignments.length}
          </Text>
          <Text style={styles.summaryHint}>
            Your assignments update automatically.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Assigned flights and shifts</Text>

        {loading ? (
          <View style={styles.messageCard}>
            <ActivityIndicator size="large" color={BLUE} />
            <Text style={styles.muted}>Loading your assignments...</Text>
          </View>
        ) : error ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : assignments.length === 0 ? (
          <View style={styles.messageCard}>
            <Text style={styles.emptyTitle}>No assignments yet</Text>
            <Text style={styles.muted}>
              Your supervisor has not assigned any tasks to your account.
              Check back later.
            </Text>
          </View>
        ) : (
          <View style={styles.assignmentList}>
            {assignments.map((assignment) => {
              const isUpdating = updatingId === assignment.id;
              const attendanceStatus =
                assignment.attendanceStatus ?? 'Not Checked In';

              return (
                <View key={assignment.id} style={styles.assignmentCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.flightNumber}>
                      {assignment.flightNumber}
                    </Text>

                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>
                        {assignment.status}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.activity}>{assignment.activity}</Text>

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

                  <View style={styles.attendanceCard}>
                    <Text style={styles.attendanceHeading}>
                      Shift attendance
                    </Text>

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

                    {attendanceStatus === 'Checked In' ||
                    attendanceStatus === 'Checked Out' ? (
                      <Text style={styles.attendanceDetail}>
                        Check-out: {formatTimestamp(assignment.checkOutAt)}
                      </Text>
                    ) : null}

                    {attendanceStatus === 'Checked Out' ? (
                      <Text style={styles.attendanceDetail}>
                        Shift duration:{' '}
                        {formatDuration(
                          assignment.checkInAt,
                          assignment.checkOutAt
                        )}
                      </Text>
                    ) : null}

                    {attendanceStatus === 'Not Checked In' && (
                      <Pressable
                        accessibilityRole="button"
                        disabled={!!updatingId}
                        onPress={() =>
                          updateAttendance(assignment, 'checkIn')
                        }
                        style={({ pressed }) => [
                          styles.actionButton,
                          pressed && styles.buttonPressed,
                          !!updatingId && styles.buttonDisabled,
                        ]}
                      >
                        {isUpdating ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.actionButtonText}>
                            Check in
                          </Text>
                        )}
                      </Pressable>
                    )}

                    {attendanceStatus === 'Checked In' && (
                      <Pressable
                        accessibilityRole="button"
                        disabled={!!updatingId}
                        onPress={() =>
                          updateAttendance(assignment, 'checkOut')
                        }
                        style={({ pressed }) => [
                          styles.checkoutButton,
                          pressed && styles.buttonPressed,
                          !!updatingId && styles.buttonDisabled,
                        ]}
                      >
                        {isUpdating ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.actionButtonText}>
                            Check out
                          </Text>
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

                  <Text style={styles.taskHeading}>Task progress</Text>

                  {assignment.status === 'Assigned' && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={!!updatingId}
                      onPress={() =>
                        updateTaskStatus(assignment, 'In Progress')
                      }
                      style={({ pressed }) => [
                        styles.actionButton,
                        pressed && styles.buttonPressed,
                        !!updatingId && styles.buttonDisabled,
                      ]}
                    >
                      {isUpdating ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.actionButtonText}>
                          Start task
                        </Text>
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
                        styles.checkoutButton,
                        pressed && styles.buttonPressed,
                        !!updatingId && styles.buttonDisabled,
                      ]}
                    >
                      {isUpdating ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.actionButtonText}>
                          Mark as completed
                        </Text>
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
              );
            })}
          </View>
        )}

        {updateError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{updateError}</Text>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Attendance and task records</Text>
          <Text style={styles.muted}>
            Check-in and check-out record your shift attendance. Starting and
            completing a task updates its task status separately. Changes
            synchronize through Firebase.
          </Text>
        </View>

        <Text style={styles.footer}>AeroSync · Ground operations</Text>
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
  summaryCard: {
    backgroundColor: NAVY,
    borderRadius: 18,
    padding: 22,
    marginTop: 6,
    marginBottom: 10,
    gap: 7,
  },
  summaryLabel: {
    color: '#DCEBFA',
    fontSize: 13,
  },
  summaryNumber: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
  },
  summaryHint: {
    color: '#DCEBFA',
    fontSize: 12,
  },
  sectionTitle: {
    color: NAVY,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 8,
  },
  assignmentList: {
    gap: 12,
  },
  assignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 17,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  flightNumber: {
    color: NAVY,
    fontSize: 21,
    fontWeight: '900',
    flexShrink: 1,
  },
  statusBadge: {
    backgroundColor: '#EAF2FC',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    color: BLUE,
    fontSize: 11,
    fontWeight: '800',
  },
  activity: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    gap: 9,
    marginTop: 4,
  },
  attendanceHeading: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '800',
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
  taskHeading: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  checkoutButton: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  actionButtonText: {
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
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  completedText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '800',
  },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: NAVY,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 17,
    gap: 8,
    marginTop: 8,
  },
  infoTitle: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    marginTop: 20,
  },
});

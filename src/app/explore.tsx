import { auth, db } from '@/lib/firebase';
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Assignment = {
  id: string;
  flightNumber?: string;
  shiftDate?: string;
  shiftTime?: string;
  activity?: string;
  status?: string;
};

export default function MyTasksScreen() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    const assignmentsQuery = query(
      collection(db, 'CrewAssignments'),
      where('handlerUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      assignmentsQuery,
      (snapshot) => {
        const tasks: Assignment[] = snapshot.docs.map((item) => ({
          id: item.id,
          flightNumber: item.data().flightNumber,
          shiftDate: item.data().shiftDate,
          shiftTime: item.data().shiftTime,
          activity: item.data().activity,
          status: item.data().status ?? 'Assigned',
        }));

        setAssignments(tasks);
        setLoading(false);
      },
      (error) => {
        console.error('Could not load tasks:', error);
        setLoading(false);
        Alert.alert(
          'Unable to load tasks',
          'Please check your connection and try again.'
        );
      }
    );

    return unsubscribe;
  }, []);

  async function updateTask(assignment: Assignment) {
    const currentStatus = assignment.status ?? 'Assigned';

    if (
      currentStatus !== 'Assigned' &&
      currentStatus !== 'In Progress'
    ) {
      return;
    }

    const nextStatus =
      currentStatus === 'Assigned' ? 'In Progress' : 'Completed';

    setUpdatingId(assignment.id);

    try {
      await updateDoc(doc(db, 'CrewAssignments', assignment.id), {
        status: nextStatus,
      });
    } catch (error) {
      console.error('Could not update task:', error);
      Alert.alert(
        'Update failed',
        'Your task could not be updated. Please try again.'
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const inProgress = assignments.filter(
    (task) => task.status === 'In Progress'
  ).length;

  const completed = assignments.filter(
    (task) => task.status === 'Completed'
  ).length;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>AEROSYNC · CREW WORKSPACE</Text>
          <Text style={styles.title}>My Tasks</Text>
          <Text style={styles.subtitle}>
            View your assignments and track your task progress.
          </Text>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{assignments.length}</Text>
            <Text style={styles.summaryLabel}>Total tasks</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{inProgress}</Text>
            <Text style={styles.summaryLabel}>In progress</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{completed}</Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>All assignments</Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#163B65"
            style={styles.loader}
          />
        ) : assignments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No assignments yet</Text>
            <Text style={styles.emptyText}>
              Assignments from your supervisor will appear here.
            </Text>
          </View>
        ) : (
          assignments.map((assignment) => {
            const status = assignment.status ?? 'Assigned';
            const isCompleted = status === 'Completed';
            const isUpdating = updatingId === assignment.id;

            return (
              <View key={assignment.id} style={styles.taskCard}>
                <View style={styles.cardTop}>
                  <View style={styles.flightBlock}>
                    <Text style={styles.flightLabel}>FLIGHT</Text>
                    <Text style={styles.flightNumber}>
                      {assignment.flightNumber || 'Not specified'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      status === 'In Progress' && styles.progressBadge,
                      isCompleted && styles.completedBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isCompleted && styles.completedText,
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.activity}>
                  {assignment.activity || 'General handling'}
                </Text>

                <Text style={styles.detail}>
                  Shift date: {assignment.shiftDate || 'Not specified'}
                </Text>

                <Text style={styles.detail}>
                  Shift time: {assignment.shiftTime || 'Not specified'}
                </Text>

                {!isCompleted &&
                  (status === 'Assigned' || status === 'In Progress') && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isUpdating}
                      onPress={() => updateTask(assignment)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        pressed && styles.pressed,
                        isUpdating && styles.disabledButton,
                      ]}
                    >
                      {isUpdating ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.actionButtonText}>
                          {status === 'Assigned'
                            ? 'Start task'
                            : 'Mark as completed'}
                        </Text>
                      )}
                    </Pressable>
                  )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#163B65',
    borderRadius: 18,
    padding: 22,
    marginBottom: 20,
  },
  eyebrow: {
    color: '#BBD7F5',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#E2EAF5',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    color: '#163B65',
    fontSize: 23,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#163B65',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  loader: {
    marginTop: 30,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    color: '#163B65',
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  flightBlock: {
    flex: 1,
  },
  flightLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  flightNumber: {
    color: '#163B65',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  progressBadge: {
    backgroundColor: '#DBEAFE',
  },
  completedBadge: {
    backgroundColor: '#DCFCE7',
  },
  statusText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  completedText: {
    color: '#166534',
  },
  activity: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
  },
  detail: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 5,
  },
  actionButton: {
    backgroundColor: '#2878C8',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
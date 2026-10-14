
import { auth, db } from '@/lib/firebase';
import {
    addDoc,
    collection,
    onSnapshot,
    query,
    serverTimestamp,
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
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Handler = {
  uid: string;
  displayName?: string;
  email?: string;
  role: string;
};

type CrewAssignment = {
  id: string;
  handlerUid: string;
  handlerName: string;
  flightNumber: string;
  shiftDate: string;
  shiftTime: string;
  activity: string;
  status: string;
};

const NAVY = '#163B65';
const BLUE = '#2878C8';
const BG = '#F4F6FA';
const MUTED = '#64748B';

const ACTIVITIES = [
  'Loading baggage',
  'Offloading baggage',
  'Baggage transfer',
  'Baggage reconciliation',
];

export default function CrewScreen({
  onBack,
}: {
  onBack?: () => void;
}) {
  const [handlers, setHandlers] = useState<Handler[]>([]);
  const [assignments, setAssignments] = useState<CrewAssignment[]>([]);
  const [selectedHandler, setSelectedHandler] = useState<Handler | null>(null);

  const [flightNumber, setFlightNumber] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [shiftTime, setShiftTime] = useState('');
  const [activity, setActivity] = useState(ACTIVITIES[0]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setError('Please sign in to manage crew assignments.');
      setLoading(false);
      return;
    }

    const handlersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'handler')
    );

    const unsubscribeHandlers = onSnapshot(
      handlersQuery,
      (snapshot) => {
        const results: Handler[] = snapshot.docs
          .map((item) => ({
            uid: item.id,
            ...(item.data() as Omit<Handler, 'uid'>),
          }))
          .sort((a, b) =>
            (a.displayName || a.email || '').localeCompare(
              b.displayName || b.email || ''
            )
          );

        setHandlers(results);
        setLoading(false);
      },
      (snapshotError) => {
        console.error('Could not load handlers:', snapshotError);
        setError('Unable to load handlers. Check your connection and permissions.');
        setLoading(false);
      }
    );

    const unsubscribeAssignments = onSnapshot(
      collection(db, 'CrewAssignments'),
      (snapshot) => {
        const results: CrewAssignment[] = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            handlerUid: data.handlerUid ?? '',
            handlerName: data.handlerName ?? 'Unknown handler',
            flightNumber: data.flightNumber ?? '',
            shiftDate: data.shiftDate ?? '',
            shiftTime: data.shiftTime ?? '',
            activity: data.activity ?? '',
            status: data.status ?? 'Assigned',
          };
        });

        results.sort((a, b) =>
          `${a.shiftDate} ${a.shiftTime}`.localeCompare(
            `${b.shiftDate} ${b.shiftTime}`
          )
        );

        setAssignments(results);
      },
      (snapshotError) => {
        console.error('Could not load assignments:', snapshotError);
        setError(
          'Could not load assignments. Check the CrewAssignments Firestore rules.'
        );
      }
    );

    return () => {
      unsubscribeHandlers();
      unsubscribeAssignments();
    };
  }, []);

  async function saveAssignment() {
    if (!auth.currentUser) {
      Alert.alert('Sign-in required', 'Please sign in again.');
      return;
    }

    if (!selectedHandler) {
      Alert.alert('Select a handler', 'Choose an approved handler first.');
      return;
    }

    if (!flightNumber.trim() || !shiftDate.trim() || !shiftTime.trim()) {
      Alert.alert(
        'Missing details',
        'Enter the flight number, shift date and shift time.'
      );
      return;
    }

    // Expected date format: YYYY-MM-DD.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate.trim())) {
      Alert.alert('Check the date', 'Use YYYY-MM-DD, for example 2026-10-16.');
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, 'CrewAssignments'), {
        handlerUid: selectedHandler.uid,
        handlerName:
          selectedHandler.displayName ||
          selectedHandler.email ||
          'Approved handler',
        flightNumber: flightNumber.trim().toUpperCase(),
        shiftDate: shiftDate.trim(),
        shiftTime: shiftTime.trim(),
        activity,
        status: 'Assigned',
        assignedBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      setFlightNumber('');
      setShiftDate('');
      setShiftTime('');
      setSelectedHandler(null);
      setActivity(ACTIVITIES[0]);

      Alert.alert('Assignment saved', 'The crew assignment has been created.');
    } catch (saveError) {
      console.error('Could not save assignment:', saveError);
      Alert.alert(
        'Could not save assignment',
        'Check that the CrewAssignments Firestore rules have been added and published, then try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmSave() {
    if (Platform.OS === 'web') {
      void saveAssignment();
    } else {
      Alert.alert(
        'Create assignment?',
        `Assign ${selectedHandler?.displayName || selectedHandler?.email || 'the selected handler'} to ${flightNumber.trim().toUpperCase()}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save assignment', onPress: () => void saveAssignment() },
        ]
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onBack} style={styles.backButton} disabled={!onBack}>
          <Text style={styles.backText}>← Back to dashboard</Text>
        </Pressable>

        <Text style={styles.eyebrow}>SUPERVISOR OPERATIONS</Text>
        <Text style={styles.heading}>Crew coordination</Text>
        <Text style={styles.subtitle}>
          Assign approved handlers to flights, shifts and baggage-handling tasks.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{handlers.length}</Text>
            <Text style={styles.statLabel}>Approved handlers</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{assignments.length}</Text>
            <Text style={styles.statLabel}>Saved assignments</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. Select a handler</Text>
          <Text style={styles.helper}>
            Choose the person who will perform the task.
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={BLUE} />
          ) : handlers.length === 0 ? (
            <Text style={styles.muted}>
              No approved handlers found. Approve a handler first.
            </Text>
          ) : (
            handlers.map((handler) => {
              const selected = selectedHandler?.uid === handler.uid;

              return (
                <Pressable
                  key={handler.uid}
                  onPress={() => setSelectedHandler(handler)}
                  style={[
                    styles.handlerOption,
                    selected && styles.handlerOptionSelected,
                  ]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(handler.displayName || handler.email || '?')
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.handlerInfo}>
                    <Text style={styles.handlerName}>
                      {handler.displayName || 'Name not provided'}
                    </Text>
                    <Text style={styles.muted}>
                      {handler.email || 'Email not available'}
                    </Text>
                  </View>

                  <Text style={styles.selectText}>
                    {selected ? 'Selected ✓' : 'Select'}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. Assignment details</Text>

          <Text style={styles.label}>Flight number</Text>
          <TextInput
            value={flightNumber}
            onChangeText={setFlightNumber}
            placeholder="e.g. KQ 100"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
            style={styles.input}
          />

          <Text style={styles.label}>Shift date</Text>
          <TextInput
            value={shiftDate}
            onChangeText={setShiftDate}
            placeholder="YYYY-MM-DD, e.g. 2026-10-16"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

          <Text style={styles.label}>Shift time</Text>
          <TextInput
            value={shiftTime}
            onChangeText={setShiftTime}
            placeholder="e.g. 06:00-14:00"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

          <Text style={styles.label}>Baggage-handling activity</Text>
          <View style={styles.activityList}>
            {ACTIVITIES.map((item) => (
              <Pressable
                key={item}
                onPress={() => setActivity(item)}
                style={[
                  styles.activityOption,
                  activity === item && styles.activitySelected,
                ]}
              >
                <Text
                  style={[
                    styles.activityText,
                    activity === item && styles.activityTextSelected,
                  ]}
                >
                  {activity === item ? '✓  ' : ''}
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={confirmSave}
            disabled={saving || loading || handlers.length === 0}
            style={[
              styles.saveButton,
              (saving || loading || handlers.length === 0) &&
                styles.saveButtonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Create assignment</Text>
            )}
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3. Saved assignments</Text>
          <Text style={styles.helper}>
            Assignments saved to Firestore appear here.
          </Text>

          {assignments.length === 0 ? (
            <Text style={styles.muted}>
              No assignments yet. Create the first assignment above.
            </Text>
          ) : (
            assignments.map((assignment) => (
              <View key={assignment.id} style={styles.assignmentCard}>
                <View style={styles.assignmentHeader}>
                  <Text style={styles.flightTitle}>
                    {assignment.flightNumber}
                  </Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{assignment.status}</Text>
                  </View>
                </View>

                <Text style={styles.assignmentName}>
                  {assignment.handlerName}
                </Text>
                <Text style={styles.muted}>
                  {assignment.shiftDate} · {assignment.shiftTime}
                </Text>
                <Text style={styles.activityLabel}>{assignment.activity}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer}>AeroSync · Ground crew coordination</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  content: {
    padding: 22,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    gap: 12,
  },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { color: BLUE, fontSize: 14, fontWeight: '700' },
  eyebrow: {
    color: BLUE,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  heading: { color: NAVY, fontSize: 28, fontWeight: '800' },
  subtitle: { color: MUTED, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 5,
  },
  statNumber: { color: NAVY, fontSize: 27, fontWeight: '800' },
  statLabel: { color: MUTED, fontSize: 12 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 17,
    gap: 12,
  },
  sectionTitle: { color: NAVY, fontSize: 18, fontWeight: '800' },
  helper: { color: MUTED, fontSize: 13, lineHeight: 19 },
  handlerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  handlerOptionSelected: {
    borderColor: BLUE,
    backgroundColor: '#EFF6FF',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF2FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: NAVY, fontSize: 17, fontWeight: '800' },
  handlerInfo: { flex: 1, gap: 3 },
  handlerName: { color: NAVY, fontSize: 14, fontWeight: '700' },
  muted: { color: MUTED, fontSize: 12, lineHeight: 18 },
  selectText: { color: BLUE, fontSize: 12, fontWeight: '800' },
  label: { color: NAVY, fontSize: 13, fontWeight: '700', marginTop: 3 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: NAVY,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
  },
  activityList: { gap: 8 },
  activityOption: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
  },
  activitySelected: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  activityText: { color: NAVY, fontSize: 13 },
  activityTextSelected: { color: BLUE, fontWeight: '700' },
  saveButton: {
    backgroundColor: BLUE,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 19 },
  assignmentCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    gap: 7,
  },
  assignmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  flightTitle: { color: NAVY, fontSize: 18, fontWeight: '800' },
  statusBadge: {
    backgroundColor: '#E5F4EA',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: { color: '#21663C', fontSize: 11, fontWeight: '700' },
  assignmentName: { color: NAVY, fontSize: 14, fontWeight: '700' },
  activityLabel: { color: BLUE, fontSize: 13, fontWeight: '700' },
  footer: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    marginTop: 20,
  },
});

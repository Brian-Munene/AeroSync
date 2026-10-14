
import { auth, db } from '@/lib/firebase';
import {
    collection,
    onSnapshot,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NAVY = '#163B65';
const BLUE = '#2878C8';
const BG = '#F4F6FA';
const MUTED = '#64748B';
const STALE_BAGGAGE_MINUTES = 60;

type Assignment = {
  id: string;
  flightNumber: string;
  handlerUid: string;
  handlerName: string;
  shiftDate: string;
  shiftTime: string;
  activity: string;
  status: string;
};

type BaggageRecord = {
  id: string;
  baggageId: string;
  flightId: string;
  status: string;
  createdAt: Date | null;
};

export default function DelayRiskScreen({
  onBack,
}: {
  onBack?: () => void;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [baggageRecords, setBaggageRecords] = useState<BaggageRecord[]>([]);
  const [selectedFlight, setSelectedFlight] = useState('');
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingBaggage, setLoadingBaggage] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth.currentUser) {
      setError('Please sign in to assess operational risk.');
      setLoadingAssignments(false);
      setLoadingBaggage(false);
      return;
    }

    const unsubscribeAssignments = onSnapshot(
      collection(db, 'CrewAssignments'),
      (snapshot) => {
        const results: Assignment[] = snapshot.docs.map((item) => {
          const data = item.data();

          return {
            id: item.id,
            flightNumber: data.flightNumber ?? '',
            handlerUid: data.handlerUid ?? '',
            handlerName: data.handlerName ?? 'Unknown handler',
            shiftDate: data.shiftDate ?? '',
            shiftTime: data.shiftTime ?? '',
            activity: data.activity ?? '',
            status: data.status ?? 'Assigned',
          };
        });

        setAssignments(results);
        setLoadingAssignments(false);
        setError('');
      },
      (err) => {
        console.error('Could not load assignments:', err);
        setError('Could not read crew assignments. Check Firestore permissions.');
        setLoadingAssignments(false);
      }
    );

    const unsubscribeBaggage = onSnapshot(
      collection(db, 'BaggageRecords'),
      (snapshot) => {
        const results: BaggageRecord[] = snapshot.docs.map((item) => {
          const data = item.data();
          const timestamp = data.createdAt;

          return {
            id: item.id,
            baggageId: data.baggageId ?? item.id,
            flightId: data.flightId ?? '',
            status: data.status ?? 'Unknown',
            createdAt:
              timestamp && typeof timestamp.toDate === 'function'
                ? timestamp.toDate()
                : null,
          };
        });

        setBaggageRecords(results);
        setLoadingBaggage(false);
      },
      (err) => {
        console.error('Could not load baggage records:', err);
        setError(
          'Could not read baggage records. Check Firestore permissions.'
        );
        setLoadingBaggage(false);
      }
    );

    return () => {
      unsubscribeAssignments();
      unsubscribeBaggage();
    };
  }, []);

  const flights = useMemo(() => {
    const identifiers = new Set<string>();

    assignments.forEach((item) => {
      if (item.flightNumber.trim()) {
        identifiers.add(item.flightNumber.trim());
      }
    });

    baggageRecords.forEach((item) => {
      if (item.flightId.trim()) {
        identifiers.add(item.flightId.trim());
      }
    });

    return Array.from(identifiers).sort();
  }, [assignments, baggageRecords]);

  useEffect(() => {
    if (flights.length === 0) {
      setSelectedFlight('');
      return;
    }

    if (!flights.includes(selectedFlight)) {
      setSelectedFlight(flights[0]);
    }
  }, [flights, selectedFlight]);

  const flightAssignments = assignments.filter(
    (item) => item.flightNumber === selectedFlight
  );

  const flightBaggage = baggageRecords.filter(
    (item) => item.flightId === selectedFlight
  );

  const now = Date.now();

  const overdueAssignments = flightAssignments.filter((item) => {
    if (item.status.toLowerCase() !== 'assigned') {
      return false;
    }

    const match = item.shiftTime.match(
      /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/
    );

    if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(item.shiftDate)) {
      return false;
    }

    const [, , , endHour, endMinute] = match;

    const shiftEnd = new Date(
      `${item.shiftDate}T${endHour.padStart(2, '0')}:${endMinute}:00`
    ).getTime();

    return Number.isFinite(shiftEnd) && shiftEnd < now;
  });

  const oldRegisteredBaggage = flightBaggage.filter((item) => {
    if (item.status.toLowerCase() !== 'registered' || !item.createdAt) {
      return false;
    }

    const ageMinutes = (now - item.createdAt.getTime()) / 60000;

    return ageMinutes >= STALE_BAGGAGE_MINUTES;
  });

  const warnings: string[] = [];

  if (overdueAssignments.length > 0) {
    warnings.push(
      `${overdueAssignments.length} assignment(s) remain Assigned after their scheduled shift end.`
    );
  }

  if (oldRegisteredBaggage.length > 0) {
    warnings.push(
      `${oldRegisteredBaggage.length} baggage record(s) remain Registered for at least ${STALE_BAGGAGE_MINUTES} minutes.`
    );
  }

  const warningCount =
    Number(overdueAssignments.length > 0) +
    Number(oldRegisteredBaggage.length > 0);

  const risk = warningCount >= 2
    ? 'High'
    : warningCount === 1
      ? 'Medium'
      : 'Low';

  const riskColor =
    risk === 'High'
      ? '#B91C1C'
      : risk === 'Medium'
        ? '#B45309'
        : '#15803D';

  const isLoading = loadingAssignments || loadingBaggage;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={onBack}
          disabled={!onBack}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back to dashboard</Text>
        </Pressable>

        <Text style={styles.eyebrow}>SUPERVISOR OPERATIONS</Text>
        <Text style={styles.heading}>Delay-risk monitoring</Text>
        <Text style={styles.subtitle}>
          Review assignment and baggage indicators for an individual flight.
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Provisional rule-based assessment</Text>
          <Text style={styles.noticeText}>
            These indicators flag possible operational issues. They do not
            establish that a flight will be delayed. The thresholds are
            demonstration settings, not validated aviation standards.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.messageCard}>
            <ActivityIndicator size="large" color={BLUE} />
            <Text style={styles.muted}>Loading operational records...</Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Select a flight</Text>
              <Text style={styles.muted}>
                Choose an identifier from your existing assignment or baggage
                records.
              </Text>

              {flights.length === 0 ? (
                <Text style={styles.muted}>
                  No flight identifiers are available yet.
                </Text>
              ) : (
                flights.map((flight) => (
                  <Pressable
                    key={flight}
                    onPress={() => setSelectedFlight(flight)}
                    style={[
                      styles.flightOption,
                      selectedFlight === flight && styles.flightSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.flightOptionText,
                        selectedFlight === flight &&
                          styles.flightSelectedText,
                      ]}
                    >
                      {flight}
                    </Text>
                    <Text style={styles.selectLabel}>
                      {selectedFlight === flight ? 'Selected ✓' : 'Select'}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>

            {selectedFlight ? (
              <>
                <View style={styles.riskCard}>
                  <Text style={styles.riskLabel}>ESTIMATED OPERATIONAL RISK</Text>
                  <Text style={[styles.riskValue, { color: riskColor }]}>
                    {risk.toUpperCase()}
                  </Text>
                  <Text style={styles.riskExplanation}>
                    {warningCount === 0
                      ? 'No configured warning conditions were detected in the available records. This does not guarantee an absence of delay risk.'
                      : `${warningCount} warning category(ies) detected. Review the details below.`}
                  </Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>
                      {flightAssignments.length} assignment(s) ·{' '}
                      {flightBaggage.length} baggage record(s)
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Assessment findings</Text>

                <View style={styles.findingCard}>
                  <Text style={styles.findingTitle}>
                    Overdue crew assignments
                  </Text>
                  <Text style={styles.findingNumber}>
                    {overdueAssignments.length}
                  </Text>
                  <Text style={styles.muted}>
                    Assignments still marked Assigned after their scheduled
                    shift end.
                  </Text>
                  {overdueAssignments.map((item) => (
                    <Text key={item.id} style={styles.detailText}>
                      • {item.handlerName} — {item.activity} ({item.shiftTime})
                    </Text>
                  ))}
                </View>

                <View style={styles.findingCard}>
                  <Text style={styles.findingTitle}>
                    Potentially stalled baggage
                  </Text>
                  <Text style={styles.findingNumber}>
                    {oldRegisteredBaggage.length}
                  </Text>
                  <Text style={styles.muted}>
                    Records still at Registered for at least{' '}
                    {STALE_BAGGAGE_MINUTES} minutes, based on creation time.
                    This is a warning for review, not proof of stalled handling.
                  </Text>
                  {oldRegisteredBaggage.map((item) => (
                    <Text key={item.id} style={styles.detailText}>
                      • {item.baggageId} — {item.status}
                    </Text>
                  ))}
                </View>

                <View style={styles.findingCard}>
                  <Text style={styles.findingTitle}>Assignment overview</Text>
                  {flightAssignments.length === 0 ? (
                    <Text style={styles.muted}>
                      No assignments match this exact flight identifier.
                    </Text>
                  ) : (
                    flightAssignments.map((item) => (
                      <View key={item.id} style={styles.recordRow}>
                        <Text style={styles.recordTitle}>
                          {item.handlerName}
                        </Text>
                        <Text style={styles.muted}>
                          {item.activity} · {item.shiftDate} · {item.shiftTime}
                        </Text>
                        <Text style={styles.statusText}>
                          Status: {item.status}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.findingCard}>
                  <Text style={styles.findingTitle}>Baggage overview</Text>
                  {flightBaggage.length === 0 ? (
                    <Text style={styles.muted}>
                      No baggage records match this exact flight identifier.
                    </Text>
                  ) : (
                    flightBaggage.map((item) => (
                      <View key={item.id} style={styles.recordRow}>
                        <Text style={styles.recordTitle}>{item.baggageId}</Text>
                        <Text style={styles.muted}>
                          Current status: {item.status}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.methodCard}>
                  <Text style={styles.sectionTitle}>How risk is classified</Text>
                  <Text style={styles.muted}>
                    Low: no configured warning categories detected.
                  </Text>
                  <Text style={styles.muted}>
                    Medium: one warning category detected.
                  </Text>
                  <Text style={styles.muted}>
                    High: both overdue assignments and old Registered baggage
                    are detected.
                  </Text>
                  <Text style={styles.footnote}>
                    This is a provisional rule-based indicator, not a trained
                    Decision Tree prediction.
                  </Text>
                </View>
              </>
            ) : null}
          </>
        )}

        <Text style={styles.footer}>AeroSync · Operational decision support</Text>
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
  notice: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    gap: 6,
  },
  noticeTitle: { color: '#9A3412', fontSize: 14, fontWeight: '800' },
  noticeText: { color: '#9A3412', fontSize: 12, lineHeight: 19 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  sectionTitle: { color: NAVY, fontSize: 18, fontWeight: '800' },
  muted: { color: MUTED, fontSize: 12, lineHeight: 19 },
  flightOption: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 11,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  flightSelected: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  flightOptionText: { color: NAVY, fontSize: 14, fontWeight: '700' },
  flightSelectedText: { color: BLUE },
  selectLabel: { color: BLUE, fontSize: 12, fontWeight: '800' },
  riskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 22,
    gap: 10,
  },
  riskLabel: { color: MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  riskValue: { fontSize: 34, fontWeight: '900' },
  riskExplanation: { color: NAVY, fontSize: 13, lineHeight: 20 },
  countPill: {
    alignSelf: 'flex-start',
    backgroundColor: BG,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  countText: { color: NAVY, fontSize: 12, fontWeight: '700' },
  findingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 8,
  },
  findingTitle: { color: NAVY, fontSize: 15, fontWeight: '800' },
  findingNumber: { color: NAVY, fontSize: 26, fontWeight: '800' },
  detailText: { color: NAVY, fontSize: 12, lineHeight: 18 },
  recordRow: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    marginTop: 4,
    gap: 4,
  },
  recordTitle: { color: NAVY, fontSize: 13, fontWeight: '700' },
  statusText: { color: BLUE, fontSize: 12, fontWeight: '700' },
  methodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 9,
  },
  footnote: { color: '#9A3412', fontSize: 12, lineHeight: 18, marginTop: 4 },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 19 },
  footer: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    marginTop: 20,
  },
});

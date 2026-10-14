
import { auth, db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
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

type BaggageRecord = {
  id: string;
  baggageId?: string;
  flightId?: string;
  qrId?: string;
  status?: string;
  createdAt?: { toDate?: () => Date } | Date | string;
};

const NAVY = '#163B65';
const BLUE = '#2878C8';
const BG = '#F4F6FA';
const MUTED = '#64748B';

export default function BaggageScreen({
  onBack,
}: {
  onBack?: () => void;
}) {
  const [records, setRecords] = useState<BaggageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth.currentUser) {
      setError('Please sign in to view baggage records.');
      setLoading(false);
      return;
    }

    const baggageQuery = query(
      collection(db, 'BaggageRecords'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      baggageQuery,
      (snapshot) => {
        setRecords(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<BaggageRecord, 'id'>),
          }))
        );
        setError('');
        setLoading(false);
      },
      (snapshotError) => {
        console.error('Could not load baggage records:', snapshotError);
        setError(
          'Unable to load baggage records. Check your connection and Firebase permissions.'
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  function formatDate(value: BaggageRecord['createdAt']) {
    if (!value) return 'Date unavailable';

    try {
      let date: Date;

      if (value instanceof Date) {
        date = value;
      } else if (
        typeof value === 'object' &&
        typeof value.toDate === 'function'
      ) {
        date = value.toDate();
      } else {
        date = new Date(value as string);
      }

      if (Number.isNaN(date.getTime())) return 'Date unavailable';

      return date.toLocaleString();
    } catch {
      return 'Date unavailable';
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          disabled={!onBack}
        >
          <Text style={styles.backText}>← Back to dashboard</Text>
        </Pressable>

        <Text style={styles.eyebrow}>SUPERVISOR OPERATIONS</Text>
        <Text style={styles.heading}>Baggage operations</Text>
        <Text style={styles.subtitle}>
          Monitor registered baggage and its latest handling status.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total baggage records</Text>
          <Text style={styles.summaryNumber}>
            {loading ? '—' : records.length}
          </Text>
          <Text style={styles.summaryHint}>Live Firestore records</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Registered baggage</Text>
          {!loading && (
            <Text style={styles.recordCount}>
              {records.length} {records.length === 1 ? 'record' : 'records'}
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.messageCard}>
            <ActivityIndicator size="large" color={NAVY} />
            <Text style={styles.mutedText}>Loading baggage records…</Text>
          </View>
        ) : error ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : records.length === 0 ? (
          <View style={styles.messageCard}>
            <Text style={styles.emptyTitle}>No baggage registered yet</Text>
            <Text style={styles.mutedText}>
              Registered baggage will appear here when records are added.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {records.map((record) => (
              <View key={record.id} style={styles.recordCard}>
                <View style={styles.recordHeader}>
                  <View style={styles.bagIcon}>
                    <Text style={styles.bagIconText}>▦</Text>
                  </View>

                  <View style={styles.recordInfo}>
                    <Text style={styles.baggageId}>
                      {record.baggageId || 'Baggage ID unavailable'}
                    </Text>
                    <Text style={styles.flightId}>
                      Flight: {record.flightId || 'Not specified'}
                    </Text>
                  </View>

                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {record.status || 'Unknown'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>QR ID</Text>
                  <Text style={styles.detailValue}>
                    {record.qrId || 'Not assigned'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Registered</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(record.createdAt)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

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
  content: {
    padding: 22,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    gap: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  backText: {
    color: BLUE,
    fontSize: 14,
    fontWeight: '700',
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
    padding: 22,
    marginTop: 8,
    marginBottom: 16,
  },
  summaryLabel: {
    color: '#DCEBFA',
    fontSize: 14,
  },
  summaryNumber: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 6,
  },
  summaryHint: {
    color: '#DCEBFA',
    fontSize: 12,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    color: NAVY,
    fontSize: 20,
    fontWeight: '700',
  },
  recordCount: {
    color: MUTED,
    fontSize: 12,
  },
  list: {
    gap: 14,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 17,
    gap: 14,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bagIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EAF2FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagIconText: {
    color: BLUE,
    fontSize: 22,
    fontWeight: '700',
  },
  recordInfo: {
    flex: 1,
    gap: 5,
  },
  baggageId: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '800',
  },
  flightId: {
    color: MUTED,
    fontSize: 13,
  },
  statusBadge: {
    backgroundColor: '#E5F4EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    maxWidth: 120,
  },
  statusText: {
    color: '#21663C',
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabel: {
    color: MUTED,
    fontSize: 13,
  },
  detailValue: {
    color: NAVY,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
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
    fontWeight: '700',
    textAlign: 'center',
  },
  mutedText: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    marginTop: 24,
  },
});

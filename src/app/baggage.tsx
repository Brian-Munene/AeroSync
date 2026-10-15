import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import RegisterBaggageScreen from '@/components/register-baggage-screen';

type BaggageRecord = {
  id: string;
  baggageId?: string;
  flightId?: string;
  baggageReference?: string;
  status?: string;
  qrId?: string;
  qrPayload?: string;
  registeredBy?: string;
  createdAt?: unknown;
};

type BaggageScreenProps = {
  onBack?: () => void;
};

export default function BaggageScreen({ onBack }: BaggageScreenProps) {
  const [records, setRecords] = useState<BaggageRecord[]>([]);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  useEffect(() => {
    const baggageQuery = query(
      collection(db, 'BaggageRecords'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      baggageQuery,
      (snapshot) => {
        const baggageRecords: BaggageRecord[] = snapshot.docs.map(
          (record) => ({
            id: record.id,
            ...(record.data() as Omit<BaggageRecord, 'id'>),
          }),
        );

        setRecords(baggageRecords);
      },
      (error) => {
        console.error('Error loading baggage records:', error);
      },
    );

    return unsubscribe;
  }, []);

  if (showRegisterForm) {
    return (
      <RegisterBaggageScreen onBack={() => setShowRegisterForm(false)} />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.title}>Baggage Operations</Text>
        <Text style={styles.subtitle}>
          Register new baggage and view all registered bags.
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, styles.registerButton]}
          onPress={() => setShowRegisterForm(true)}
        >
          <Text style={styles.primaryButtonText}>＋ Register Baggage</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Registered Baggage</Text>

          {records.length === 0 ? (
            <Text style={styles.emptyText}>
              No baggage records yet.
            </Text>
          ) : (
            records.map((record) => (
              <View key={record.id} style={styles.record}>
                <View style={styles.recordMain}>
                  <Text style={styles.recordBaggageId}>
                    {record.baggageId || record.id}
                  </Text>

                  <Text style={styles.recordFlight}>
                    Flight: {record.flightId || '—'}
                  </Text>

                  <Text style={styles.recordReference}>
                    Reference: {record.baggageReference || '—'}
                  </Text>
                </View>

                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>
                    {record.status || 'Registered'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2878C8',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#163B65',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#687386',
    marginBottom: 20,
    lineHeight: 21,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#163B65',
    marginBottom: 16,
  },
  primaryButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#2878C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  registerButton: {
    marginBottom: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    color: '#7A8494',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  record: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E7EF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  recordMain: {
    flex: 1,
    paddingRight: 10,
  },
  recordBaggageId: {
    fontSize: 16,
    fontWeight: '800',
    color: '#163B65',
    marginBottom: 4,
  },
  recordFlight: {
    fontSize: 14,
    color: '#4E5969',
    marginBottom: 2,
  },
  recordReference: {
    fontSize: 13,
    color: '#7A8494',
  },
  statusBadge: {
    backgroundColor: '#EAF3FC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2878C8',
  },
});
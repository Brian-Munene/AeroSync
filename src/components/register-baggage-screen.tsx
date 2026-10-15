import { auth, db } from '@/lib/firebase';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import BaggageQrCard from '@/components/baggage-qr-card';
import { buildQrPayload } from '@/features/baggage/qr';
import { validateFlightNumber } from '@/features/baggage/validation';

export type RegisteredBaggage = {
  id: string;
  baggageId: string;
  flightId: string;
  baggageReference: string;
  status: 'Registered';
  qrId: string;
  qrPayload: string;
  registeredBy: string;
};

type RegisterBaggageScreenProps = {
  onBack: () => void;
};

export default function RegisterBaggageScreen({
  onBack,
}: RegisterBaggageScreenProps) {
  const [flightNumber, setFlightNumber] = useState('');
  const [baggageReference, setBaggageReference] = useState('');
  const [registering, setRegistering] = useState(false);
  // The bag just registered; while set, the page shows its result and QR.
  const [registered, setRegistered] = useState<RegisteredBaggage | null>(null);

  const registerBaggage = async () => {
    if (registering) {
      return;
    }

    const flightCheck = validateFlightNumber(flightNumber);
    const reference = baggageReference.trim().toUpperCase();

    if (!flightCheck.ok) {
      Alert.alert('Invalid flight number', flightCheck.error);
      return;
    }

    if (!reference) {
      Alert.alert('Missing information', 'Please enter the baggage reference.');
      return;
    }

    if (!auth.currentUser) {
      Alert.alert('Not signed in', 'Please sign in again.');
      return;
    }

    setRegistering(true);

    try {
      // Generate the ID first so the whole record is saved in one write.
      const newRecord = doc(collection(db, 'BaggageRecords'));
      const fields = {
        baggageId: `BAG-${newRecord.id}`,
        flightId: flightCheck.flight,
        baggageReference: reference,
        status: 'Registered' as const,
        qrId: newRecord.id,
        qrPayload: buildQrPayload(newRecord.id),
        registeredBy: auth.currentUser.uid,
      };

      await setDoc(newRecord, { ...fields, createdAt: serverTimestamp() });

      const record: RegisteredBaggage = { id: newRecord.id, ...fields };

      setRegistered(record);
      setFlightNumber('');
      setBaggageReference('');
    } catch (error) {
      console.error('Error registering baggage:', error);

      Alert.alert(
        'Registration failed',
        'The baggage could not be registered. Please try again.',
      );
    } finally {
      setRegistering(false);
    }
  };

  const registerAnother = () => {
    setRegistered(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          disabled={registering}
        >
          <Text style={styles.backButtonText}>‹ Back to baggage</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Register Baggage</Text>
        <Text style={styles.subtitle}>
          {registered
            ? 'The bag has been saved. Attach or save its QR code below.'
            : 'Enter the bag details. A QR code is generated as soon as it is saved.'}
        </Text>

        {registered ? (
          <>
            <View style={[styles.card, styles.successCard]}>
              <Text style={styles.successTitle}>✓ Baggage registered</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Baggage ID</Text>
                <Text style={styles.detailValue}>{registered.baggageId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Flight</Text>
                <Text style={styles.detailValue}>{registered.flightId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reference</Text>
                <Text style={styles.detailValue}>
                  {registered.baggageReference}
                </Text>
              </View>
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>{registered.status}</Text>
              </View>
            </View>

            <BaggageQrCard record={registered} title="Baggage QR Code" />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={registerAnother}
            >
              <Text style={styles.primaryButtonText}>Register another bag</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.textButton} onPress={onBack}>
              <Text style={styles.textButtonText}>Done, back to baggage</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Flight Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. KQ100"
              placeholderTextColor="#8A94A6"
              value={flightNumber}
              onChangeText={setFlightNumber}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!registering}
            />

            <Text style={styles.label}>Baggage Reference</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. BAG001"
              placeholderTextColor="#8A94A6"
              value={baggageReference}
              onChangeText={setBaggageReference}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!registering}
              returnKeyType="done"
              onSubmitEditing={registerBaggage}
            />

            <TouchableOpacity
              style={[
                styles.primaryButton,
                registering && styles.disabledButton,
              ]}
              onPress={registerBaggage}
              disabled={registering}
            >
              <Text style={styles.primaryButtonText}>
                {registering ? 'Registering…' : 'Register Baggage'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Matches the Baggage Operations screen styling.
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
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3D4858',
    marginBottom: 7,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D9DFE8',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1E293B',
    marginBottom: 15,
    backgroundColor: '#FAFBFD',
  },
  primaryButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#2878C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.5,
  },
  successCard: {
    borderWidth: 1,
    borderColor: '#ABEFC6',
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#067647',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F5',
    gap: 12,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 14,
    color: '#687386',
  },
  detailValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#163B65',
    textAlign: 'right',
  },
  textButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  textButtonText: {
    color: '#2878C8',
    fontSize: 15,
    fontWeight: '700',
  },
});

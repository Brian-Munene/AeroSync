import { auth, db } from '@/lib/firebase';
import {
  cacheDirectory,
  EncodingType,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

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

const QR_PREFIX = 'AEROSYNC:BAGGAGE:';

export default function BaggageScreen({ onBack }: BaggageScreenProps) {
  const [flightNumber, setFlightNumber] = useState('');
  const [baggageReference, setBaggageReference] = useState('');
  const [records, setRecords] = useState<BaggageRecord[]>([]);
  const [selectedRecord, setSelectedRecord] =
    useState<BaggageRecord | null>(null);
  const [savingQR, setSavingQR] = useState(false);

  const qrCodeRef = useRef<{
    toDataURL: (callback: (data: string) => void) => void;
  } | null>(null);

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

        setSelectedRecord((current) => {
          if (!current) {
            return null;
          }

          return (
            baggageRecords.find((record) => record.id === current.id) ?? null
          );
        });
      },
      (error) => {
        console.error('Error loading baggage records:', error);
      },
    );

    return unsubscribe;
  }, []);

  const registerBaggage = async () => {
    const flight = flightNumber.trim().toUpperCase();
    const reference = baggageReference.trim().toUpperCase();

    if (!flight || !reference) {
      Alert.alert(
        'Missing information',
        'Please enter both the flight number and baggage reference.',
      );
      return;
    }

    if (!auth.currentUser) {
      Alert.alert('Not signed in', 'Please sign in again.');
      return;
    }

    try {
      const newRecord = await addDoc(collection(db, 'BaggageRecords'), {
        flightId: flight,
        baggageReference: reference,
        status: 'Registered',
        qrId: '',
        registeredBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      const baggageId = `BAG-${newRecord.id}`;
      const qrPayload = `${QR_PREFIX}${newRecord.id}`;

      await updateDoc(doc(db, 'BaggageRecords', newRecord.id), {
        baggageId,
        qrId: newRecord.id,
        qrPayload,
      });

      const newBaggage: BaggageRecord = {
        id: newRecord.id,
        baggageId,
        flightId: flight,
        baggageReference: reference,
        status: 'Registered',
        qrId: newRecord.id,
        qrPayload,
        registeredBy: auth.currentUser.uid,
      };

      setSelectedRecord(newBaggage);
      setFlightNumber('');
      setBaggageReference('');

      Alert.alert(
        'Baggage registered',
        `${baggageId} has been registered and its QR code generated.`,
      );
    } catch (error) {
      console.error('Error registering baggage:', error);

      Alert.alert(
        'Registration failed',
        'The baggage could not be registered. Please try again.',
      );
    }
  };

  const getQRPayload = (record: BaggageRecord) => {
    return (
      record.qrPayload ||
      `${QR_PREFIX}${record.qrId || record.id}`
    );
  };

  const saveQRToPhotos = async () => {
    if (!selectedRecord) {
      Alert.alert(
        'No baggage selected',
        'Register or select a baggage record first.',
      );
      return;
    }

    if (!cacheDirectory) {
      Alert.alert(
        'Unable to save QR',
        'The device cache directory is not available.',
      );
      return;
    }

    const permission = await MediaLibrary.requestPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Photos permission required',
        'Please allow AeroSync to access Photos so the QR code can be saved.',
      );
      return;
    }

    const qrCode = qrCodeRef.current;

    if (!qrCode) {
      Alert.alert(
        'QR not ready',
        'Please wait a moment for the QR code to finish loading, then try again.',
      );
      return;
    }

    setSavingQR(true);

    try {
      qrCode.toDataURL(async (base64: string) => {
        try {
          const safeBaggageId = (
            selectedRecord.baggageId || selectedRecord.id
          ).replace(/[^a-zA-Z0-9_-]/g, '_');

          const fileUri = `${cacheDirectory}${safeBaggageId}.png`;

          await writeAsStringAsync(fileUri, base64, {
            encoding: EncodingType.Base64,
          });

          await MediaLibrary.saveToLibraryAsync(fileUri);

          Alert.alert(
            'QR saved',
            `${selectedRecord.baggageId || selectedRecord.id} QR code has been saved to Photos.`,
          );
        } catch (error) {
          console.error('Error saving QR:', error);

          Alert.alert(
            'Save failed',
            'The QR code could not be saved to Photos. Please try again.',
          );
        } finally {
          setSavingQR(false);
        }
      });
    } catch (error) {
      console.error('Error generating QR image:', error);
      setSavingQR(false);

      Alert.alert(
        'QR export failed',
        'The QR code could not be prepared for saving.',
      );
    }
  };

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
          Register baggage and generate a QR code for handling.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Register Baggage</Text>

          <Text style={styles.label}>Flight Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. KQ100"
            placeholderTextColor="#8A94A6"
            value={flightNumber}
            onChangeText={setFlightNumber}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Baggage Reference</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. BAG001"
            placeholderTextColor="#8A94A6"
            value={baggageReference}
            onChangeText={setBaggageReference}
            autoCapitalize="characters"
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={registerBaggage}
          >
            <Text style={styles.primaryButtonText}>
              Register Baggage
            </Text>
          </TouchableOpacity>
        </View>

        {selectedRecord ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Generated QR Code</Text>

            <View style={styles.qrContainer}>
              <QRCode
                value={getQRPayload(selectedRecord)}
                size={220}
                backgroundColor="#FFFFFF"
                color="#000000"
                getRef={(ref) => {
                  qrCodeRef.current = ref;
                }}
              />
            </View>

            <Text style={styles.baggageId}>
              {selectedRecord.baggageId || selectedRecord.id}
            </Text>

            <Text style={styles.qrInstruction}>
              Save this QR code to Photos for your handler demonstration.
            </Text>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                savingQR && styles.disabledButton,
              ]}
              onPress={saveQRToPhotos}
              disabled={savingQR}
            >
              <Text style={styles.secondaryButtonText}>
                {savingQR ? 'Saving QR...' : 'Save QR to Photos'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Registered Baggage</Text>

          {records.length === 0 ? (
            <Text style={styles.emptyText}>
              No baggage records yet.
            </Text>
          ) : (
            records.map((record) => (
              <TouchableOpacity
                key={record.id}
                style={[
                  styles.record,
                  selectedRecord?.id === record.id &&
                    styles.selectedRecord,
                ]}
                onPress={() => setSelectedRecord(record)}
              >
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
              </TouchableOpacity>
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
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 12,
    marginBottom: 14,
  },
  baggageId: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#163B65',
    marginBottom: 6,
  },
  qrInstruction: {
    textAlign: 'center',
    color: '#687386',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 15,
  },
  secondaryButton: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2878C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#2878C8',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.5,
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
  selectedRecord: {
    borderColor: '#2878C8',
    backgroundColor: '#F5FAFF',
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
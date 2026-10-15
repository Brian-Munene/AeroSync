import { auth, db } from '@/lib/firebase';
import {
    CameraView,
    scanFromURLAsync,
    useCameraPermissions,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
  baggageReference?: string;
  qrId?: string;
  qrPayload?: string;
  status?: string;
};

type HandlingAction = 'Loading' | 'Offloading';

const NAVY = '#163B65';
const BLUE = '#2878C8';
const BG = '#F4F6FA';
const MUTED = '#64748B';
const QR_PREFIX = 'AEROSYNC:BAGGAGE:';

export default function ScanQRScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [scanning, setScanning] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectingImage, setSelectingImage] = useState(false);

  const [message, setMessage] = useState('');
  const [baggage, setBaggage] = useState<BaggageRecord | null>(null);

  async function lookUpBaggageFromQR(data: string) {
    setLookingUp(true);
    setMessage('');
    setBaggage(null);

    try {
      if (!data.startsWith(QR_PREFIX)) {
        setMessage('This is not a valid AeroSync baggage QR code.');
        return;
      }

      const documentId = data.slice(QR_PREFIX.length).trim();

      if (!documentId) {
        setMessage('The QR code does not contain a baggage ID.');
        return;
      }

      if (!auth.currentUser) {
        setMessage('Please sign in before scanning baggage.');
        return;
      }

      const baggageRef = doc(db, 'BaggageRecords', documentId);
      const baggageSnapshot = await getDoc(baggageRef);

      if (!baggageSnapshot.exists()) {
        setMessage('No baggage record was found for this QR code.');
        return;
      }

      const recordData = baggageSnapshot.data();

      setBaggage({
        id: baggageSnapshot.id,
        baggageId: recordData.baggageId,
        flightId: recordData.flightId,
        baggageReference: recordData.baggageReference,
        qrId: recordData.qrId,
        qrPayload: recordData.qrPayload,
        status: recordData.status,
      });
    } catch (error) {
      console.error('QR scan lookup failed:', error);

      setMessage(
        'Could not look up this baggage record. Check your connection and Firebase permissions.'
      );
    } finally {
      setLookingUp(false);
    }
  }

  async function handleBarcodeScanned({
    data,
  }: {
    data: string;
    type: string;
  }) {
    if (!scanning || lookingUp || saving) {
      return;
    }

    setScanning(false);

    await lookUpBaggageFromQR(data);
  }

  async function chooseQRFromPhotos() {
    if (selectingImage || lookingUp || saving) {
      return;
    }

    if (!auth.currentUser) {
      Alert.alert(
        'Sign in required',
        'Please sign in before selecting a baggage QR code.'
      );
      return;
    }

    setSelectingImage(true);
    setMessage('');

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      const imageUri = result.assets[0].uri;

      const scannedResults = await scanFromURLAsync(imageUri, ['qr']);

      if (scannedResults.length === 0) {
        setMessage(
          'No QR code was found in that image. Please choose an image containing the AeroSync baggage QR code.'
        );
        return;
      }

      const qrData = scannedResults[0]?.data;

      if (!qrData) {
        setMessage('The selected image does not contain readable QR data.');
        return;
      }

      await lookUpBaggageFromQR(qrData);
    } catch (error) {
      console.error('QR image scan failed:', error);

      setMessage(
        'Could not read the QR image. Please choose a clear image containing the full QR code.'
      );
    } finally {
      setSelectingImage(false);
    }
  }

  async function recordHandling(action: HandlingAction) {
    if (!baggage || !auth.currentUser) {
      Alert.alert(
        'Unable to record event',
        'Sign in and scan a valid baggage QR code first.'
      );
      return;
    }

    setSaving(true);

    try {
      const eventCollection = collection(
        db,
        'BaggageRecords',
        baggage.id,
        'handlingEvents'
      );

      console.log('STEP 1: Creating handling event...', {
        action,
        baggageDocumentId: baggage.id,
        baggageId: baggage.baggageId || baggage.id,
        flightId: baggage.flightId || '',
        handlerUid: auth.currentUser.uid,
      });

      await addDoc(eventCollection, {
        action,
        baggageId: baggage.baggageId || baggage.id,
        flightId: baggage.flightId || '',
        handlerUid: auth.currentUser.uid,
        timestamp: serverTimestamp(),
      });

      console.log('STEP 1 SUCCESS: Handling event created.');

      console.log('STEP 2: Updating baggage record...', {
        baggageDocumentId: baggage.id,
        newStatus: action === 'Loading' ? 'Loading' : 'Offloaded',
      });

      await updateDoc(doc(db, 'BaggageRecords', baggage.id), {
        status: action === 'Loading' ? 'Loading' : 'Offloaded',
        lastHandlingAction: action,
        lastHandledBy: auth.currentUser.uid,
        lastHandledAt: serverTimestamp(),
      });

      console.log('STEP 2 SUCCESS: Baggage record updated.');

      setBaggage((previous) =>
        previous
          ? {
              ...previous,
              status: action === 'Loading' ? 'Loading' : 'Offloaded',
            }
          : null
      );

      Alert.alert(
        'Handling event recorded',
        `${action} was saved for ${baggage.baggageId || baggage.id}.`
      );
    } catch (error) {
      console.error('HANDLING ERROR:', error);

      Alert.alert(
        'Could not save event',
        'Firebase rejected one of the handling operations. Check the terminal for STEP 1 or STEP 2.'
      );
    } finally {
      setSaving(false);
    }
  }

  function scanAgain() {
    setBaggage(null);
    setMessage('');
    setScanning(true);
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAVY} />
          <Text style={styles.messageText}>
            Checking camera permission…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.eyebrow}>AEROSYNC SCANNER</Text>

          <Text style={styles.heading}>
            Camera permission required
          </Text>

          <Text style={styles.messageText}>
            Allow camera access to scan baggage QR codes.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={requestPermission}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              Allow camera access
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>HANDLER OPERATIONS</Text>

        <Text style={styles.heading}>Scan baggage QR</Text>

        <Text style={styles.subtitle}>
          Scan a registered baggage QR code using your camera or select a QR
          image from your phone.
        </Text>

        {!baggage && (
          <>
            <View style={styles.cameraCard}>
              <View style={styles.cameraFrame}>
                {scanning ? (
                  <CameraView
                    style={styles.camera}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={handleBarcodeScanned}
                  />
                ) : (
                  <View style={styles.cameraPlaceholder}>
                    {lookingUp ? (
                      <>
                        <ActivityIndicator
                          size="large"
                          color={BLUE}
                        />

                        <Text style={styles.messageText}>
                          Looking up baggage…
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.placeholderIcon}>▦</Text>

                        <Text style={styles.messageText}>
                          Scanner paused
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </View>

              <Text style={styles.cameraHint}>
                Position the entire QR code inside the camera view.
              </Text>

              {message !== '' && (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{message}</Text>
                </View>
              )}

              {!scanning && !lookingUp && (
                <Pressable
                  accessibilityRole="button"
                  onPress={scanAgain}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>
                    Scan again
                  </Text>
                </Pressable>
              )}
            </View>

            <View style={styles.orRow}>
              <View style={styles.orLine} />

              <Text style={styles.orText}>OR</Text>

              <View style={styles.orLine} />
            </View>

            <View style={styles.photoCard}>
              <Text style={styles.photoTitle}>
                QR code already on this phone?
              </Text>

              <Text style={styles.photoDescription}>
                Select an image containing the baggage QR code from your
                Photos library.
              </Text>

              <Pressable
                accessibilityRole="button"
                disabled={
                  selectingImage || lookingUp || saving
                }
                onPress={chooseQRFromPhotos}
                style={[
                  styles.secondaryButton,
                  (selectingImage || lookingUp || saving) &&
                    styles.disabledButton,
                ]}
              >
                {selectingImage ? (
                  <ActivityIndicator color={BLUE} />
                ) : (
                  <Text style={styles.secondaryButtonText}>
                    Choose QR from Photos
                  </Text>
                )}
              </Pressable>
            </View>
          </>
        )}

        {baggage && (
          <View style={styles.recordCard}>
            <View style={styles.successHeader}>
              <View style={styles.successIcon}>
                <Text style={styles.successIconText}>✓</Text>
              </View>

              <View style={styles.recordInfo}>
                <Text style={styles.sectionTitle}>
                  Baggage verified
                </Text>

                <Text style={styles.subtitle}>
                  Matching Firestore record found.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Baggage ID</Text>

              <Text style={styles.detailValue}>
                {baggage.baggageId || baggage.id}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Flight</Text>

              <Text style={styles.detailValue}>
                {baggage.flightId || 'Not specified'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reference</Text>

              <Text style={styles.detailValue}>
                {baggage.baggageReference || 'Not specified'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Current status</Text>

              <Text style={styles.statusValue}>
                {baggage.status || 'Unknown'}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>
              Record handling event
            </Text>

            <Text style={styles.formHint}>
              Select the action performed by the handler. Each action
              creates a timestamped event in Firestore.
            </Text>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => recordHandling('Loading')}
              style={[
                styles.primaryButton,
                saving && styles.disabledButton,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Record Loading
                </Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => recordHandling('Offloading')}
              style={[
                styles.offloadButton,
                saving && styles.disabledButton,
              ]}
            >
              <Text style={styles.offloadButtonText}>
                Record Offloading
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={scanAgain}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                Scan another bag
              </Text>
            </Pressable>
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
    gap: 14,
  },

  center: {
    flex: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },

  eyebrow: {
    color: BLUE,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
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
  },

  cameraCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  cameraFrame: {
    width: '100%',
    height: 350,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },

  camera: {
    flex: 1,
  },

  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
    backgroundColor: '#F8FAFC',
  },

  placeholderIcon: {
    fontSize: 42,
    color: BLUE,
  },

  cameraHint: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  messageText: {
    color: MUTED,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },

  errorCard: {
    padding: 13,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
  },

  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },

  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5E1',
  },

  orText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
  },

  photoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 12,
  },

  photoTitle: {
    color: NAVY,
    fontSize: 17,
    fontWeight: '800',
  },

  photoDescription: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
  },

  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 16,
  },

  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  successIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E5F4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  successIconText: {
    color: '#21663C',
    fontSize: 22,
    fontWeight: '800',
  },

  recordInfo: {
    flex: 1,
    gap: 4,
  },

  sectionTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: '800',
  },

  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
  },

  detailLabel: {
    color: MUTED,
    fontSize: 13,
  },

  detailValue: {
    color: NAVY,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },

  statusValue: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },

  formHint: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
  },

  primaryButton: {
    backgroundColor: BLUE,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },

  offloadButton: {
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  offloadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  secondaryButton: {
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    color: BLUE,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  disabledButton: {
    opacity: 0.6,
  },

  footer: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    marginTop: 12,
  },
});
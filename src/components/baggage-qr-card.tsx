import {
  cacheDirectory,
  EncodingType,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { buildQrPayload } from '@/features/baggage/qr';

export type QrCardRecord = {
  id: string;
  baggageId?: string;
  qrId?: string;
  qrPayload?: string;
};

type BaggageQrCardProps = {
  record: QrCardRecord;
  title?: string;
};

/** Shows a bag's QR code with its ID and a "Save QR to Photos" action. */
export default function BaggageQrCard({
  record,
  title = 'Generated QR Code',
}: BaggageQrCardProps) {
  const [savingQR, setSavingQR] = useState(false);
  const qrCodeRef = useRef<{
    toDataURL: (callback: (data: string) => void) => void;
  } | null>(null);

  const displayId = record.baggageId || record.id;
  const payload = record.qrPayload || buildQrPayload(record.qrId || record.id);

  const saveQRToPhotos = async () => {
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
          const safeBaggageId = displayId.replace(/[^a-zA-Z0-9_-]/g, '_');
          const fileUri = `${cacheDirectory}${safeBaggageId}.png`;

          await writeAsStringAsync(fileUri, base64, {
            encoding: EncodingType.Base64,
          });

          await MediaLibrary.saveToLibraryAsync(fileUri);

          Alert.alert(
            'QR saved',
            `${displayId} QR code has been saved to Photos.`,
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
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>

      <View style={styles.qrContainer}>
        <QRCode
          value={payload}
          size={220}
          backgroundColor="#FFFFFF"
          color="#000000"
          getRef={(ref) => {
            qrCodeRef.current = ref;
          }}
        />
      </View>

      <Text style={styles.baggageId}>{displayId}</Text>

      <Text style={styles.qrInstruction}>
        Save this QR code to Photos for your handler demonstration.
      </Text>

      <TouchableOpacity
        style={[styles.secondaryButton, savingQR && styles.disabledButton]}
        onPress={saveQRToPhotos}
        disabled={savingQR}
      >
        <Text style={styles.secondaryButtonText}>
          {savingQR ? 'Saving QR...' : 'Save QR to Photos'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
});

import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function FirebaseTestScreen() {
const [status, setStatus] = useState('Ready to test supervisor access.');
const [loading, setLoading] = useState(false);

async function testConnection() {
setLoading(true);

try {
  const user = auth.currentUser;

  if (!user) {
    setStatus('Not signed in. Please sign in to AeroSync first.');
    return;
  }

  const baggageQuery = query(
    collection(db, 'BaggageRecords'),
    where('baggageId', '==', 'BAG-TEST-001')
  );

  const snapshot = await getDocs(baggageQuery);

  setStatus(
    `Signed in as: ${user.email ?? user.uid}\n` +
      `Records found: ${snapshot.size}\n` +
      (snapshot.empty
        ? 'Read permission succeeded, but the test record was not found.'
        : 'SUCCESS: The account can read the test baggage record.')
  );
} catch (error) {
  console.error('Firebase security test failed:', error);
  setStatus(
    `Read failed: ${error instanceof Error ? error.message : String(error)}`
  );
} finally {
  setLoading(false);
}

}

async function handleSignOut() {
try {
await signOut(auth);
} catch (error) {
console.error('Sign-out failed:', error);
}
}

return (
<View style={styles.container}>
<Text style={styles.title}>AeroSync Security Test</Text>
<Text style={styles.status}>{status}</Text>

  <Pressable
    style={styles.button}
    onPress={testConnection}
    disabled={loading}
  >
    {loading ? (
      <ActivityIndicator color="#FFFFFF" />
    ) : (
      <Text style={styles.buttonText}>Test Firestore Read</Text>
    )}
  </Pressable>

  <Pressable style={styles.button} onPress={handleSignOut}>
    <Text style={styles.buttonText}>Sign out</Text>
  </Pressable>
</View>

);
}

const styles = StyleSheet.create({
container: {
flex: 1,
justifyContent: 'center',
alignItems: 'center',
padding: 24,
gap: 20,
backgroundColor: '#F4F6FA',
},
title: {
fontSize: 24,
fontWeight: '700',
color: '#163B65',
textAlign: 'center',
},
status: {
fontSize: 15,
lineHeight: 23,
textAlign: 'center',
color: '#334155',
},
button: {
backgroundColor: '#163B65',
borderRadius: 10,
paddingVertical: 14,
paddingHorizontal: 22,
},
buttonText: {
color: '#FFFFFF',
fontWeight: '700',
fontSize: 15,
},
});
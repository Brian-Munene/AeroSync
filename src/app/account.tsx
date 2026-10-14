import { signOut } from 'firebase/auth';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';

export default function AccountScreen() {
const [role, setRole] = useState('Loading…');
const [signingOut, setSigningOut] = useState(false);

useEffect(() => {
const user = auth.currentUser;
if (!user) return;

return onSnapshot(
  doc(db, 'users', user.uid),
  (snapshot) => {
    if (snapshot.exists()) {
      setRole(String(snapshot.data().role ?? 'Unknown'));
    } else {
      setRole('Profile unavailable');
    }
  },
  () => setRole('Unable to load role')
);

}, []);

async function handleSignOut() {
setSigningOut(true);
try {
await signOut(auth);
} catch {
Alert.alert('Sign out failed', 'Please check your connection and try again.');
} finally {
setSigningOut(false);
}
}

return (
<View style={styles.container}>
<Text style={styles.title}>My Account</Text>
<Text style={styles.label}>Signed in as</Text>
<Text style={styles.value}>{auth.currentUser?.email ?? 'No signed-in user'}</Text>

  <Text style={styles.label}>Account role</Text>
  <Text style={styles.value}>{role}</Text>

  <Pressable
    accessibilityRole="button"
    style={styles.button}
    onPress={handleSignOut}
    disabled={signingOut}
  >
    {signingOut ? (
      <ActivityIndicator color="#FFFFFF" />
    ) : (
      <Text style={styles.buttonText}>Sign out</Text>
    )}
  </Pressable>
</View>

);
}

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: '#F4F6FA',
padding: 24,
justifyContent: 'center',
},
title: {
fontSize: 28,
fontWeight: '700',
color: '#163B65',
marginBottom: 28,
},
label: {
color: '#64748B',
fontSize: 14,
marginTop: 16,
},
value: {
color: '#163B65',
fontSize: 17,
fontWeight: '600',
marginTop: 6,
},
button: {
backgroundColor: '#163B65',
padding: 16,
borderRadius: 10,
alignItems: 'center',
marginTop: 36,
},
buttonText: {
color: '#FFFFFF',
fontWeight: '700',
fontSize: 16,
},
});
import AppTabs from '@/components/app-tabs';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AuthScreen from '@/components/auth-screen';
import { auth, db } from '@/lib/firebase';

SplashScreen.preventAutoHideAsync();

type Role = 'pending' | 'handler' | 'supervisor';

const isRole = (value: unknown): value is Role =>
value === 'pending' || value === 'handler' || value === 'supervisor';

export default function RootLayout() {
const colorScheme = useColorScheme();
const [user, setUser] = useState<User | null>(null);
const [role, setRole] = useState<Role | null>(null);
const [loading, setLoading] = useState(true);
const [profileError, setProfileError] = useState(false);

useEffect(() => {
let unsubscribeProfile: (() => void) | undefined;
let graceTimer: ReturnType<typeof setTimeout> | undefined;

const clearGrace = () => {
  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimer = undefined;
  }
};

const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
  unsubscribeProfile?.();
  unsubscribeProfile = undefined;
  clearGrace();

  setUser(currentUser);
  setRole(null);
  setProfileError(false);

  if (!currentUser) {
    setLoading(false);
    return;
  }

  setLoading(true);

  unsubscribeProfile = onSnapshot(
    doc(db, 'users', currentUser.uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        if (!graceTimer) {
          graceTimer = setTimeout(() => {
            setProfileError(true);
            setLoading(false);
          }, 8000);
        }
        return;
      }

      clearGrace();
      const profileRole = snapshot.data().role;

      if (!isRole(profileRole)) {
        setProfileError(true);
        setLoading(false);
        return;
      }

      setRole(profileRole);
      setProfileError(false);
      setLoading(false);
    },
    (error) => {
      clearGrace();
      console.error('Could not load user profile:', error);
      setProfileError(true);
      setLoading(false);
    }
  );
});

return () => {
  unsubscribeAuth();
  unsubscribeProfile?.();
  clearGrace();
};

}, []);

async function handleSignOut() {
try {
await signOut(auth);
} catch (error) {
console.error('Sign-out failed:', error);
}
}

let content;

if (loading) {
content = (
<View style={styles.center}>
<ActivityIndicator size="large" color="#163B65" />
<Text style={styles.message}>Checking your account…</Text>
</View>
);
} else if (!user) {
content = <AuthScreen />;
} else if (profileError || !role) {
content = (
<View style={styles.center}>
<Text style={styles.title}>Profile unavailable</Text>
<Text style={styles.message}>
Your account profile could not be verified. Access to operational
records is blocked. Contact your supervisor or sign out.
</Text>
<Text style={styles.link} onPress={handleSignOut}>
Sign out
</Text>
</View>
);
} else if (role === 'pending') {
content = (
<View style={styles.center}>
<Text style={styles.title}>Awaiting approval</Text>
<Text style={styles.message}>
Your account has been created. A supervisor must approve it before
you can access AeroSync operational records.
</Text>
<Text style={styles.link} onPress={handleSignOut}>
Sign out
</Text>
</View>
);
} else {
content = <AppTabs role={role} />;
}

return (
<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
<AnimatedSplashOverlay />
{content}
</ThemeProvider>
);
}

const styles = StyleSheet.create({
center: {
flex: 1,
justifyContent: 'center',
alignItems: 'center',
padding: 28,
gap: 14,
backgroundColor: '#F4F6FA',
},
title: {
fontSize: 24,
fontWeight: '700',
color: '#163B65',
textAlign: 'center',
},
message: {
fontSize: 15,
lineHeight: 23,
color: '#475569',
textAlign: 'center',
},
link: {
color: '#163B65',
fontSize: 16,
fontWeight: '700',
padding: 12,
},
});
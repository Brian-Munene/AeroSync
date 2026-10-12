
import { auth, db } from '@/lib/firebase';
import {
    createUserWithEmailAndPassword,
    deleteUser,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from 'firebase/auth';
import {
    doc,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export type Role = 'pending' | 'handler' | 'supervisor';

export default function AuthScreen() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  function showMessage(title: string, message: string) {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  async function handleSubmit() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();

    if (!cleanEmail || !password) {
      showMessage('Missing details', 'Enter your email and password.');
      return;
    }

    if (isRegistering && !cleanName) {
      showMessage('Missing name', 'Enter your full name.');
      return;
    }

    if (isRegistering && password.length < 8) {
      showMessage(
        'Password too short',
        'Use at least 8 characters for your password.'
      );
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      showMessage('Passwords do not match', 'Check both password fields.');
      return;
    }

    setLoading(true);

    try {
      if (!isRegistering) {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        return;
      }

      const credential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      const userRef = doc(db, 'users', credential.user.uid);

      try {
        // The Firestore profile is essential to the approval workflow.
        await setDoc(userRef, {
          uid: credential.user.uid,
          email: cleanEmail,
          displayName: cleanName,
          role: 'pending' satisfies Role,
          createdAt: serverTimestamp(),
        });
      } catch (profileError) {
        // Attempt to remove the Auth account if its required profile fails.
        try {
          await deleteUser(credential.user);
        } catch (deleteError) {
          console.error('Account rollback failed:', deleteError);
          try {
            await signOut(auth);
          } catch (signOutError) {
            console.error('Sign-out failed:', signOutError);
          }
        }

        throw profileError;
      }

      // Auth display name is useful, but not required for security.
      try {
        await updateProfile(credential.user, {
          displayName: cleanName,
        });
      } catch (profileNameError) {
        console.warn('Could not update Auth display name:', profileNameError);
      }

      showMessage(
        'Account created',
        'Your account is awaiting supervisor approval. Baggage access is unavailable until approval.'
      );
    } catch (error: any) {
      console.error('Authentication failed:', error);

      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'An account already uses this email.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/invalid-credential': 'Email or password is incorrect.',
        'auth/weak-password': 'Choose a stronger password.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/too-many-requests':
          'Too many attempts. Wait a while before trying again.',
        'auth/network-request-failed':
          'Network error. Check your internet connection and try again.',
        'permission-denied':
          'Your profile could not be created. Please try again or contact a supervisor.',
      };

      showMessage(
        isRegistering ? 'Registration failed' : 'Login failed',
        messages[error?.code] ??
          'Something went wrong. Check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.brand}>AeroSync</Text>
          <Text style={styles.subtitle}>
            Ground crew coordination and baggage tracking
          </Text>

          <Text style={styles.heading}>
            {isRegistering ? 'Create your account' : 'Welcome back'}
          </Text>

          {isRegistering && (
            <TextInput
              style={styles.input}
              placeholder="Full name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              editable={!loading}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

          {isRegistering && (
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />
          )}

          <Pressable
            style={[styles.primaryButton, loading && styles.disabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isRegistering ? 'Create account' : 'Log in'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setIsRegistering(!isRegistering)}
            disabled={loading}
            style={styles.switchButton}
          >
            <Text style={styles.switchText}>
              {isRegistering
                ? 'Already have an account? Log in'
                : "Don't have an account? Register"}
            </Text>
          </Pressable>

          <Text style={styles.notice}>
            New accounts require supervisor approval before accessing operational
            records.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#F4F6FA',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 18,
    gap: 14,
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: '#163B65',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 13,
    marginBottom: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#172033',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#172033',
    backgroundColor: '#FFFFFF',
  },
  primaryButton: {
    backgroundColor: '#163B65',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    color: '#163B65',
    fontWeight: '600',
    textAlign: 'center',
  },
  notice: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
});

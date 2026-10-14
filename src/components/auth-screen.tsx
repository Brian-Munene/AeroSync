
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
type RequestedRole = 'handler' | 'supervisor';

export default function AuthScreen() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requestedRole, setRequestedRole] =
    useState<RequestedRole>('handler');
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
      // Existing users log in with their email and password.
      if (!isRegistering) {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        return;
      }

      // Create the Firebase Authentication account.
      console.log('REGISTRATION: Creating Firebase Auth account...');

      const credential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      console.log('REGISTRATION: Auth account created.', {
        uid: credential.user.uid,
        projectId: db.app.options.projectId,
      });

      const userRef = doc(db, 'users', credential.user.uid);

      // Every new account starts as pending.
      try {
        console.log('REGISTRATION: Saving Firestore profile...', {
          uid: credential.user.uid,
          email: cleanEmail,
          requestedRole,
          projectId: db.app.options.projectId,
          collection: 'users',
        });

        await setDoc(userRef, {
          uid: credential.user.uid,
          email: cleanEmail,
          displayName: cleanName,
          role: 'pending' satisfies Role,
          requestedRole,
          createdAt: serverTimestamp(),
        });

        console.log(
          'REGISTRATION: Firestore profile saved successfully.',
          credential.user.uid
        );
      } catch (profileError) {
        console.error(
          'REGISTRATION: Firestore profile save FAILED:',
          profileError
        );

        // Roll back the Auth account if its required profile cannot be saved.
        try {
          await deleteUser(credential.user);
          console.log('REGISTRATION: Auth account rollback succeeded.');
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

      // Set the display name in Firebase Authentication.
      try {
        await updateProfile(credential.user, {
          displayName: cleanName,
        });
      } catch (profileNameError) {
        console.warn(
          'Could not update Auth display name:',
          profileNameError
        );
      }

      const approvalMessage =
        requestedRole === 'supervisor'
          ? 'Your supervisor registration request has been submitted. Supervisor access requires separate authorization.'
          : 'Your handler account is awaiting supervisor approval. Baggage access is unavailable until approval.';

      showMessage('Account created', approvalMessage);
    } catch (error: any) {
      console.error('Authentication failed:', error);

      const messages: Record<string, string> = {
        'auth/email-already-in-use':
          'An account already uses this email.',
        'auth/invalid-email':
          'Enter a valid email address.',
        'auth/invalid-credential':
          'Email or password is incorrect.',
        'auth/weak-password':
          'Choose a stronger password.',
        'auth/user-disabled':
          'This account has been disabled.',
        'auth/too-many-requests':
          'Too many attempts. Wait a while before trying again.',
        'auth/network-request-failed':
          'Network error. Check your internet connection and try again.',
        'permission-denied':
          'Your profile could not be created. Please check the Firestore rules and try again.',
        'firestore/permission-denied':
          'Your profile could not be created. Please check the Firestore rules and try again.',
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

  function toggleMode() {
    setIsRegistering((previous) => !previous);
    setConfirmPassword('');
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

          {/* Role selection is displayed only during registration. */}
          {isRegistering && (
            <>
              <Text style={styles.roleHeading}>Register as</Text>

              <View style={styles.roleOptions}>
                <Pressable
                  style={[
                    styles.roleCard,
                    requestedRole === 'handler' &&
                      styles.roleCardSelected,
                  ]}
                  onPress={() => setRequestedRole('handler')}
                  disabled={loading}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: requestedRole === 'handler',
                  }}
                >
                  <Text style={styles.roleIcon}>🧳</Text>
                  <Text style={styles.roleTitle}>Handler</Text>
                  <Text style={styles.roleDescription}>
                    Baggage handling and shift duties
                  </Text>
                  {requestedRole === 'handler' && (
                    <Text style={styles.selectedText}>✓ Selected</Text>
                  )}
                </Pressable>

                <Pressable
                  style={[
                    styles.roleCard,
                    requestedRole === 'supervisor' &&
                      styles.roleCardSelected,
                  ]}
                  onPress={() => setRequestedRole('supervisor')}
                  disabled={loading}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: requestedRole === 'supervisor',
                  }}
                >
                  <Text style={styles.roleIcon}>📋</Text>
                  <Text style={styles.roleTitle}>Supervisor</Text>
                  <Text style={styles.roleDescription}>
                    Crew and operations management
                  </Text>
                  {requestedRole === 'supervisor' && (
                    <Text style={styles.selectedText}>✓ Selected</Text>
                  )}
                </Pressable>
              </View>

              {requestedRole === 'supervisor' && (
                <Text style={styles.roleNotice}>
                  Supervisor access requires separate authorization.
                  Selecting this option does not grant supervisor privileges.
                </Text>
              )}

              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor="#94A3B8"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                editable={!loading}
              />
            </>
          )}

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#94A3B8"
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
            placeholderTextColor="#94A3B8"
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
              placeholderTextColor="#94A3B8"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />
          )}

          <Pressable
            style={[
              styles.primaryButton,
              loading && styles.disabled,
            ]}
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
            onPress={toggleMode}
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
            New accounts require authorization before accessing operational
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
  roleHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#172033',
    marginBottom: -4,
  },
  roleOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  roleCardSelected: {
    borderColor: '#163B65',
    borderWidth: 2,
    backgroundColor: '#EFF6FF',
  },
  roleIcon: {
    fontSize: 26,
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#163B65',
  },
  roleDescription: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    color: '#64748B',
  },
  selectedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#163B65',
  },
  roleNotice: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
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

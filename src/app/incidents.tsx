import { StyleSheet, Text, View } from 'react-native';

export default function IncidentsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Incident Reporting</Text>
      <Text style={styles.message}>
        Report and track ground-handling incidents here.
      </Text>
      <Text style={styles.status}>Feature coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F4F6FA',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#163B65',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
  },
  status: {
    marginTop: 16,
    color: '#2878C8',
    fontWeight: '600',
  },
});
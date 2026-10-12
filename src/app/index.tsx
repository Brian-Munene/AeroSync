
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NAVY = '#163B65';
const BLUE = '#2878C8';
const BG = '#F4F6FA';
const MUTED = '#64748B';

function FeatureCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
      <Text style={styles.openLink}>Open →</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>AeroSync</Text>
            <Text style={styles.subtitle}>Ground operations dashboard</Text>
          </View>
          <View style={styles.status}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Connected</Text>
          </View>
        </View>

        <View style={styles.welcome}>
          <Text style={styles.eyebrow}>GROUND CREW OPERATIONS</Text>
          <Text style={styles.heading}>Good to have you back.</Text>
          <Text style={styles.welcomeText}>
            Coordinate baggage handling and keep turnaround activities organised.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Operations</Text>

        <View style={styles.grid}>
          <FeatureCard
            icon="＋"
            title="Register baggage"
            description="Create a baggage record and prepare it for QR tracking."
            onPress={() => {}}
          />
          <FeatureCard
            icon="▦"
            title="Scan baggage QR"
            description="Identify a bag and record its handling progress."
            onPress={() => {}}
          />
          <FeatureCard
            icon="✈"
            title="Baggage records"
            description="View registered bags, flights and current statuses."
            onPress={() => {}}
          />
          <FeatureCard
            icon="◷"
            title="Delay risk"
            description="Review operational indicators and potential delays."
            onPress={() => {}}
          />
          <FeatureCard
            icon="♧"
            title="Crew coordination"
            description="A space for assignments, incidents and handovers."
            onPress={() => {}}
          />
        </View>



        <Text style={styles.footer}>AeroSync · Ground crew coordination</Text>
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
    paddingBottom: 36,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    gap: 12,
  },
  brand: {
    color: NAVY,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: MUTED,
    fontSize: 13,
    marginTop: 3,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#E5F4EA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#21854A',
  },
  statusText: {
    color: '#21663C',
    fontSize: 12,
    fontWeight: '600',
  },
  welcome: {
    backgroundColor: NAVY,
    borderRadius: 20,
    padding: 26,
    marginBottom: 28,
  },
  eyebrow: {
    color: '#B8D8FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
  },
  welcomeText: {
    color: '#E2ECF8',
    fontSize: 15,
    lineHeight: 23,
  },
  sectionTitle: {
    color: NAVY,
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '48%',
    flexGrow: 1,
    flexBasis: 250,
    minHeight: 190,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EAF2FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  icon: {
    fontSize: 23,
    color: BLUE,
    fontWeight: '700',
  },
  cardTitle: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 7,
  },
  cardDescription: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  openLink: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 14,
  },

  footer: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    marginTop: 28,
  },
});

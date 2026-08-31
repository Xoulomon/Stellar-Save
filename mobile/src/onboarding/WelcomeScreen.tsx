import { StyleSheet, Text, View, Pressable } from 'react-native';

interface Props {
  onContinue: () => void;
}

export function WelcomeScreen({ onContinue }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Stellar Save</Text>
      <Text style={styles.body}>
        Let&apos;s set up your wallet and verify your identity so you can start saving.
      </Text>
      <Pressable style={styles.button} onPress={onContinue}>
        <Text style={styles.buttonText}>Get started</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14, textAlign: 'center', color: '#555' },
  button: { backgroundColor: '#0B6BCB', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});

import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';

interface Props {
  /** Wired to #996's createWallet()/importFromSecretKey() — kept as a prop so this screen has no hard dependency on that branch landing first. */
  onCreateWallet: () => Promise<void>;
  onImportWallet: () => void;
  onDone: () => void;
}

export function WalletSetupScreen({ onCreateWallet, onImportWallet, onDone }: Props) {
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreateWallet();
      onDone();
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set up your wallet</Text>
      <Pressable style={styles.button} onPress={handleCreate} disabled={creating}>
        {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create a new wallet</Text>}
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={onImportWallet}>
        <Text style={styles.secondaryButtonText}>Import existing wallet</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  button: { backgroundColor: '#0B6BCB', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, minWidth: 200, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 24 },
  secondaryButtonText: { color: '#0B6BCB', fontWeight: '600' },
});

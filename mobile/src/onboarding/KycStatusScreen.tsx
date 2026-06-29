import { StyleSheet, Text, View } from 'react-native';

import type { KycStatus } from '../kyc/kycApi';

interface Props {
  status: KycStatus;
}

const COPY: Record<KycStatus, { title: string; body: string }> = {
  pending: {
    title: 'Verification in progress',
    body: 'We’re reviewing your documents. This usually takes a few minutes — you can keep using the app and we’ll notify you when it’s done.',
  },
  approved: {
    title: 'You’re verified',
    body: 'Identity verification is complete. Fiat ramp features are now unlocked.',
  },
  rejected: {
    title: 'Verification failed',
    body: 'We couldn’t verify your identity with the documents provided. Please re-submit with a clearer photo of a valid ID.',
  },
  expired: {
    title: 'Verification expired',
    body: 'Your verification has expired and needs to be redone before you can use fiat ramp features.',
  },
};

export function KycStatusScreen({ status }: Props) {
  const copy = COPY[status];
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14, textAlign: 'center', color: '#555' },
});

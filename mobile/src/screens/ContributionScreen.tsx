import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Contribution'>;

export function ContributionScreen({ route }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contribution</Text>
      <Text>Group: {route.params.groupId}</Text>
      <Text>Contribution detail — implemented in follow-up.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
});

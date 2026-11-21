import { useRef, useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { validateKycFields } from '../kyc/validation';
import type { KycClient, KycSubmitFields } from '../kyc/kycApi';

interface Props {
  kycClient: KycClient;
  onSubmitted: () => void;
}

export function KycFormScreen({ kycClient, onSubmitted }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [fields, setFields] = useState<Partial<KycSubmitFields>>({});
  const [errors, setErrors] = useState<ReturnType<typeof validateKycFields>['errors']>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const captureDocument = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.7 });
    if (photo?.base64) {
      setFields((prev) => ({ ...prev, documentImageBase64: photo.base64 }));
    }
  };

  const handleSubmit = async () => {
    const result = validateKycFields(fields);
    setErrors(result.errors);
    if (!result.valid) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await kycClient.submit(fields as KycSubmitFields);
      onSubmitted();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'KYC submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container} testID="kyc-form-screen">
      <Text style={styles.title}>Identity verification</Text>

      <TextInput
        style={styles.input}
        placeholder="Full name"
        value={fields.fullName ?? ''}
        onChangeText={(value) => setFields((prev) => ({ ...prev, fullName: value }))}
        testID="kyc-full-name-input"
      />
      {errors.fullName && <Text style={styles.error} testID="kyc-error-full-name">{errors.fullName}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Date of birth (YYYY-MM-DD)"
        value={fields.dateOfBirth ?? ''}
        onChangeText={(value) => setFields((prev) => ({ ...prev, dateOfBirth: value }))}
        testID="kyc-dob-input"
      />
      {errors.dateOfBirth && <Text style={styles.error} testID="kyc-error-dob">{errors.dateOfBirth}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Country (e.g. US)"
        autoCapitalize="characters"
        maxLength={2}
        value={fields.country ?? ''}
        onChangeText={(value) => setFields((prev) => ({ ...prev, country: value.toUpperCase() }))}
        testID="kyc-country-input"
      />
      {errors.country && <Text style={styles.error} testID="kyc-error-country">{errors.country}</Text>}

      {permission?.granted ? (
        <CameraView ref={cameraRef} style={styles.camera} facing="back" testID="kyc-camera-viewfinder" />
      ) : (
        <Pressable style={styles.secondaryButton} onPress={requestPermission} testID="kyc-enable-camera-button">
          <Text style={styles.secondaryButtonText}>Enable camera</Text>
        </Pressable>
      )}
      <Pressable style={styles.secondaryButton} onPress={captureDocument} testID="kyc-capture-document-button">
        <Text style={styles.secondaryButtonText}>
          {fields.documentImageBase64 ? 'Document captured ✓' : 'Capture ID document'}
        </Text>
      </Pressable>
      {errors.documentImageBase64 && <Text style={styles.error} testID="kyc-error-document">{errors.documentImageBase64}</Text>}

      {submitError && <Text style={styles.error}>{submitError}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting} testID="kyc-submit-button">
        {submitting
          ? <ActivityIndicator color="#fff" testID="kyc-submitting-indicator" />
          : <Text style={styles.buttonText}>Submit</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  camera: { width: '100%', height: 200, borderRadius: 8 },
  error: { color: '#C0392B', fontSize: 12 },
  button: { backgroundColor: '#0B6BCB', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { paddingVertical: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#0B6BCB', fontWeight: '600' },
});

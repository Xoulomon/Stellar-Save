import { useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerDeviceToken(userId: string, token: string, platform: 'ios' | 'android') {
  await fetch(`${API_BASE}/api/v1/notifications/device-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, token, platform }),
  });
}

async function requestAndRegister(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null; // emulator — skip

  const { status: existing } = await Notifications.getPermissionsAsync();
  const finalStatus =
    existing === 'granted'
      ? existing
      : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync();
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  await registerDeviceToken(userId, token, platform);
  return token;
}

/**
 * Registers the device for push notifications and wires up a tap listener.
 *
 * @param userId     Authenticated user id
 * @param onTap      Called with the notification data when the user taps a notification
 */
export function usePushNotifications(
  userId: string | null,
  onTap: (data: Record<string, string>) => void
) {
  const tapListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    if (!userId) return;
    requestAndRegister(userId).catch(console.error);

    tapListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, string>;
      onTap(data);
    });

    return () => tapListener.current?.remove();
  }, [userId]);
}

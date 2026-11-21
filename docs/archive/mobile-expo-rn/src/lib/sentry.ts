let initialized = false;

function getDsn(): string | undefined {
  return process.env.EXPO_PUBLIC_SENTRY_DSN || undefined;
}

export async function initSentry(): Promise<void> {
  if (initialized) return;
  const dsn = getDsn();
  if (!dsn) return;

  try {
    const Sentry = await import('@sentry/react-native');
    if (!Sentry.isInitialized) {
      Sentry.init({
        dsn,
        environment: process.env.EXPO_PUBLIC_APP_ENV || 'development',
        tracesSampleRate: Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
        enableAutoSessionTracking: true,
      });
    }

    const errorUtils = (globalThis as typeof globalThis & {
      ErrorUtils?: {
        getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
        setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
        __sentryWrapped?: boolean;
      };
    }).ErrorUtils;

    if (errorUtils && !errorUtils.__sentryWrapped && errorUtils.setGlobalHandler) {
      const defaultHandler = errorUtils.getGlobalHandler?.();
      errorUtils.setGlobalHandler((error, isFatal) => {
        Sentry.captureException(error, {
          extra: {
            isFatal,
          },
        });
        defaultHandler?.(error, isFatal);
      });
      errorUtils.__sentryWrapped = true;
    }

    initialized = true;
  } catch (err) {
    // Sentry must never break app startup.
    console.warn('[sentry] initialization failed', err);
  }
}

export async function captureMobileException(error: Error, context?: Record<string, unknown>): Promise<void> {
  const dsn = getDsn();
  if (!dsn) return;

  try {
    const Sentry = await import('@sentry/react-native');
    if (!Sentry.isInitialized) {
      await initSentry();
    }
    Sentry.captureException(error, {
      extra: context,
    });
  } catch (err) {
    console.warn('[sentry] exception capture failed', err);
  }
}

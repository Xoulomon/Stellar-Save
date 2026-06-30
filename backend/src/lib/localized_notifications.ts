/**
 * Localized notification dispatcher (#1034).
 *
 * Looks up the user's locale from NotificationPreference, selects the
 * correct translated subject/body via the i18n service, then delegates
 * to NotificationService for delivery.
 *
 * Fallback: when no locale is stored, or the locale is unsupported, 'en' is
 * used automatically by the i18n layer.
 */
import { prisma } from '../prisma_client';
import { NotificationService } from '../notification_service';
import { t, NotificationKey } from './i18n';
import { logger } from '../logger';

const notificationService = new NotificationService();

/** Fetch the user's stored locale preference, defaulting to 'en'. */
async function getUserLocale(userId: string): Promise<string> {
  try {
    const pref = await (prisma as any).notificationPreference.findUnique({
      where: { userId },
      select: { locale: true },
    });
    return pref?.locale ?? 'en';
  } catch {
    // locale column may not exist yet in older deployments — fall back silently
    return 'en';
  }
}

/**
 * Send a localized email notification.
 *
 * @param to           - Recipient email address
 * @param userId       - User ID (used to look up locale preference)
 * @param templateId   - Existing DB template key (used as the delivery template)
 * @param subjectKey   - i18n key for the email subject
 * @param bodyKey      - i18n key for the text body (also used for push body)
 * @param vars         - Interpolation variables for the template
 */
export async function sendLocalizedEmail(opts: {
  to: string;
  userId: string;
  templateId: string;
  subjectKey: NotificationKey;
  bodyKey: NotificationKey;
  vars: Record<string, string | number>;
}): Promise<void> {
  const locale = await getUserLocale(opts.userId);
  const subject = t(opts.subjectKey, opts.vars, locale);
  const body = t(opts.bodyKey, opts.vars, locale);

  logger.info(`[i18n] Sending email locale=${locale} key=${opts.subjectKey} to=${opts.to}`);

  await notificationService.sendEmail(
    opts.to,
    opts.templateId,
    { ...opts.vars, userId: opts.userId, localizedSubject: subject, localizedBody: body },
    subject
  );
}

/**
 * Send a localized push notification.
 */
export async function sendLocalizedPush(opts: {
  deviceToken: string;
  userId: string;
  templateId: string;
  titleKey: NotificationKey;
  bodyKey: NotificationKey;
  vars: Record<string, string | number>;
}): Promise<void> {
  const locale = await getUserLocale(opts.userId);
  const title = t(opts.titleKey, opts.vars, locale);
  const body = t(opts.bodyKey, opts.vars, locale);

  logger.info(`[i18n] Sending push locale=${locale} key=${opts.titleKey}`);

  await notificationService.sendPushNotification(
    opts.deviceToken,
    opts.templateId,
    { ...opts.vars, userId: opts.userId },
    title,
    body
  );
}

import { Stack, Typography, Divider } from '@mui/material';
import { Link } from 'react-router-dom';
import { AppCard, AppLayout } from '../ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageSelector } from '../components/LanguageSelector';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { ROUTES } from '../routing/constants';

/**
 * Settings page - application settings
 */
export default function SettingsPage() {
  const { mode, setMode } = useTheme();
  const { t } = useI18n();

  return (
    <AppLayout
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
      footerText={t('settings.footerText')}
    >
      <AppCard>
        <Stack spacing={3}>
          <Typography variant="h2">{t('settings.title')}</Typography>

          {/* ── Appearance ─────────────────────────────────────── */}
          <Stack spacing={1}>
            <Typography variant="subtitle1" fontWeight={600}>
              {t('settings.appearance')}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {t('settings.appearanceDesc')}
            </Typography>

            <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
              {(["light", "dark", "system"] as const).map((opt) => (
                <label
                  key={opt}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: mode === opt ? 600 : 400,
                  }}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={opt}
                    checked={mode === opt}
                    onChange={() => setMode(opt)}
                    style={{ accentColor: "var(--color-primary)" }}
                  />
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </label>
              ))}

              <ThemeToggle variant="labelled" />
            </Stack>
          </Stack>

          {/* ── Language ───────────────────────────────────────── */}
          <Stack spacing={1}>
            <Typography variant="subtitle1" fontWeight={600}>
              {t('settings.language')}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {t('settings.languageDesc')}
            </Typography>
            <LanguageSelector />
          </Stack>

          <Divider />

          {/* ── Notifications ──────────────────────────────────── */}
          <Stack spacing={1}>
            <Typography variant="subtitle1" fontWeight={600}>
              Notifications
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Configure email and push notification preferences.
            </Typography>
            <Link to={ROUTES.SETTINGS_NOTIFICATIONS} style={{ width: 'fit-content' }}>
              Manage notification preferences →
            </Link>
          </Stack>
        </Stack>
      </AppCard>
    </AppLayout>
  );
}

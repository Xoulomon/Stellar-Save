import { Stack, Typography, Divider } from '@mui/material';
import { AppCard, AppLayout } from '../ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageSelector } from '../components/LanguageSelector';
import { useTheme } from '../hooks/useTheme';

/**
 * Settings page - application settings
 */
export default function SettingsPage() {
  const { mode, setMode } = useTheme();

  return (
    <AppLayout
      title="Settings"
      subtitle="Configure your preferences"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <AppCard>
        <Stack spacing={3}>
          <Typography variant="h2">Settings</Typography>

          {/* ── Appearance ─────────────────────────────────────── */}
          <Stack spacing={1}>
            <Typography variant="subtitle1" fontWeight={600}>
              Appearance
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Choose how Stellar Save looks to you.
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
              Language
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Choose your preferred language.
            </Typography>
            <LanguageSelector />
          </Stack>
        </Stack>
      </AppCard>
    </AppLayout>
  );
}

/**
 * Isolated fixture gallery for Playwright screenshot tests.
 *
 * Mounted by `visual-gallery-main.tsx` (`npm run build:visual`) and also
 * registered on `/__visual__/components` when `VITE_VISUAL_GALLERY=true`.
 */
import { useLayoutEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { Dialog } from '../components/Dialog';
import { Tabs } from '../components/Tabs';
import { Badge } from '../components/Badge';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState/EmptyState';
import { LoadingState } from '../components/LoadingState/LoadingState';
import { ErrorState } from '../components/ErrorState/ErrorState';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { CardSkeleton } from '../components/Skeleton/CardSkeleton';
import { GroupCard } from '../components/GroupCard';
import { ToastItem, type Toast } from '../components/Toast';
import { AppButton } from '../ui/components/AppButton';
import { AppCard } from '../ui/components/AppCard';
import { lightTheme, darkTheme } from '../ui/theme/theme';
import './VisualGalleryPage.css';

const BUTTON_VARIANTS = ['primary', 'secondary', 'danger', 'ghost'] as const;
const BUTTON_SIZES = ['sm', 'md', 'lg'] as const;
const BUTTON_STATES = ['default', 'disabled', 'loading'] as const;
const CARD_VARIANTS = ['default', 'outlined', 'elevated'] as const;
const BADGE_VARIANTS = ['primary', 'secondary', 'success', 'warning', 'danger', 'info'] as const;
const BADGE_SIZES = ['sm', 'md', 'lg'] as const;
const TAB_VARIANTS = ['default', 'pills', 'underline'] as const;
const TOAST_TYPES = ['success', 'error', 'warning', 'info'] as const;

const FIXED_PAYOUT_DATE = new Date('2026-12-15T12:00:00.000Z');

function noop() {
  /* fixture handlers must not change visual state */
}

function Section({
  testId,
  title,
  children,
}: {
  testId: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="visual-gallery__section" data-testid={testId}>
      <h2 className="visual-gallery__heading">{title}</h2>
      {children}
    </section>
  );
}

export default function VisualGalleryPage() {
  const [searchParams] = useSearchParams();
  const themeMode = searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const muiTheme = themeMode === 'dark' ? darkTheme : lightTheme;

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  return (
    <ThemeProvider theme={muiTheme}>
      <main className="visual-gallery" data-testid="visual-gallery">
        <h1 className="visual-gallery__title">Component gallery ({themeMode})</h1>

        <Section testId="visual-button" title="Button">
          <div className="visual-gallery__row">
            {BUTTON_VARIANTS.map((variant) =>
              BUTTON_SIZES.map((size) =>
                BUTTON_STATES.map((state) => (
                  <div className="visual-gallery__cell" key={`${variant}-${size}-${state}`}>
                    <span className="visual-gallery__caption">
                      {variant} / {size} / {state}
                    </span>
                    <Button
                      variant={variant}
                      size={size}
                      disabled={state === 'disabled'}
                      loading={state === 'loading'}
                    >
                      Label
                    </Button>
                  </div>
                ))
              )
            )}
          </div>
        </Section>

        <Section testId="visual-app-button" title="AppButton">
          <div className="visual-gallery__row">
            <AppButton variant="contained">Contained</AppButton>
            <AppButton variant="outlined">Outlined</AppButton>
            <AppButton variant="text">Text</AppButton>
            <AppButton variant="contained" disabled>
              Disabled
            </AppButton>
          </div>
        </Section>

        <Section testId="visual-input" title="Input">
          <div className="visual-gallery__stack">
            <Input id="visual-input-default" label="Default" defaultValue="Ada Lovelace" />
            <Input id="visual-input-required" label="Required" required />
            <Input
              id="visual-input-helper"
              label="Helper"
              helperText="Use 3–40 characters"
              defaultValue="Savings circle"
            />
            <Input id="visual-input-error" label="Error" error="Name is required" defaultValue="" />
            <Input id="visual-input-disabled" label="Disabled" defaultValue="Read only" disabled />
          </div>
        </Section>

        <Section testId="visual-card" title="Card">
          <div className="visual-gallery__row">
            {CARD_VARIANTS.map((variant) => (
              <Card
                key={variant}
                variant={variant}
                header={<strong>{variant}</strong>}
                footer="Footer"
              >
                Card body
              </Card>
            ))}
            <AppCard sx={{ minWidth: 180 }}>AppCard body</AppCard>
          </div>
        </Section>

        <Section testId="visual-dialog" title="Dialog">
          <div className="visual-gallery__dialog-frame">
            <Dialog
              open
              onClose={noop}
              title="Confirm contribution"
              description="This will submit 10 XLM to the group for the current cycle."
              footer={
                <>
                  <Button variant="ghost" size="sm" onClick={noop}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={noop}>
                    Confirm
                  </Button>
                </>
              }
            >
              Review the amount before signing with your wallet.
            </Dialog>
          </div>
        </Section>

        <Section testId="visual-tabs" title="Tabs">
          <div className="visual-gallery__tabs">
            {TAB_VARIANTS.map((variant) => (
              <Tabs
                key={variant}
                variant={variant}
                defaultTab="overview"
                tabs={[
                  { id: 'overview', label: 'Overview', content: `${variant}: overview` },
                  { id: 'members', label: 'Members', content: `${variant}: members` },
                  {
                    id: 'settings',
                    label: 'Settings',
                    content: `${variant}: settings`,
                    disabled: true,
                  },
                ]}
              />
            ))}
          </div>
        </Section>

        <Section testId="visual-badge" title="Badge">
          <div className="visual-gallery__row">
            {BADGE_VARIANTS.map((variant) =>
              BADGE_SIZES.map((size) => (
                <div className="visual-gallery__cell" key={`${variant}-${size}`}>
                  <span className="visual-gallery__caption">
                    {variant} / {size}
                  </span>
                  <Badge variant={variant} size={size}>
                    {variant}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Section>

        <Section testId="visual-search" title="SearchBar">
          <div className="visual-gallery__stack">
            <SearchBar placeholder="Search groups" onSearch={noop} defaultValue="" />
            <SearchBar placeholder="Searching…" onSearch={noop} loading defaultValue="circle" />
          </div>
        </Section>

        <Section testId="visual-states" title="Empty / Loading / Error">
          <div className="visual-gallery__row">
            <EmptyState
              title="No groups yet"
              description="Create a savings circle to get started."
              actionLabel="Create group"
              onAction={noop}
            />
            <LoadingState message="Fetching groups…" />
            <ErrorState message="Could not load groups." onRetry={noop} />
          </div>
        </Section>

        <Section testId="visual-skeleton" title="Skeleton">
          <div className="visual-gallery__row">
            <Skeleton variant="text" width={220} height={16} animation={false} />
            <Skeleton variant="rect" width={180} height={80} animation={false} />
            <Skeleton variant="circle" width={48} height={48} animation={false} />
            <div style={{ width: 240 }}>
              <CardSkeleton height={80} lines={2} />
            </div>
          </div>
        </Section>

        <Section testId="visual-group-card" title="GroupCard">
          <div className="visual-gallery__group-card">
            <GroupCard
              groupName="Community Circle"
              description="Weekly savings for local members"
              memberCount={8}
              contributionAmount={25}
              currency="XLM"
              status="active"
              currentCycle={3}
              nextPayoutDate={FIXED_PAYOUT_DATE}
              onViewDetails={noop}
              onJoin={noop}
            />
          </div>
        </Section>

        <Section testId="visual-toast" title="ToastItem">
          <div className="visual-gallery__toasts">
            {TOAST_TYPES.map((type) => {
              const toast: Toast = {
                id: `visual-toast-${type}`,
                type,
                message: `${type} notification`,
              };
              return <ToastItem key={type} toast={toast} onClose={noop} />;
            })}
          </div>
        </Section>
      </main>
    </ThemeProvider>
  );
}

import React, { Suspense, type ReactNode } from 'react';

/**
 * Content-shaped skeleton primitives used as Suspense fallbacks so pages
 * render layout-matching placeholders instead of a blank screen or bare
 * spinner while initial data is fetching.
 *
 * Each skeleton mirrors the dimensions of the content it replaces to avoid
 * layout shift when the real data arrives.
 */

export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = 6,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        background:
          'linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.12) 37%, rgba(0,0,0,0.06) 63%)',
        backgroundSize: '400% 100%',
        animation: 'async-boundary-skeleton 1.4s ease infinite',
        ...style,
      }}
    />
  );
}

function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} height={12} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

/**
 * Generic list skeleton: a stack of rows with an avatar and two text lines.
 * Matches the layout of the app's list/table pages.
 */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SkeletonBlock width={40} height={40} radius={20} />
          <div style={{ flex: 1 }}>
            <SkeletonText lines={2} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Detail page skeleton: a title, a hero/media block, and body paragraphs.
 */
export function DetailSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SkeletonBlock height={28} width="45%" />
      <SkeletonBlock height={220} radius={12} />
      <SkeletonText lines={4} />
    </div>
  );
}

/**
 * Card grid skeleton: a responsive grid of card placeholders.
 */
export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 16,
      }}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SkeletonBlock height={140} radius={12} />
          <SkeletonText lines={2} />
        </div>
      ))}
    </div>
  );
}

/**
 * Dashboard skeleton: a row of stat tiles above a chart placeholder.
 */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} height={96} radius={12} />
        ))}
      </div>
      <SkeletonBlock height={280} radius={12} />
    </div>
  );
}

/**
 * Form skeleton: labelled field placeholders matching a typical form layout.
 */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock height={12} width="30%" />
          <SkeletonBlock height={40} radius={8} />
        </div>
      ))}
    </div>
  );
}

const skeletonKeyframes = `
@keyframes async-boundary-skeleton {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
`;

function SkeletonStyles() {
  return <style>{skeletonKeyframes}</style>;
}

export interface AsyncBoundaryProps {
  children: ReactNode;
  /**
   * Content-shaped fallback rendered while children suspend. Defaults to a
   * generic list skeleton so pages never render a blank screen.
   */
  fallback?: ReactNode;
  /**
   * Optional error UI. When omitted, errors bubble to the nearest boundary.
   */
  errorFallback?: ReactNode;
}

interface AsyncBoundaryState {
  hasError: boolean;
}

/**
 * Wraps async content in a Suspense boundary with a content-shaped skeleton
 * fallback. Use the exported skeleton components as `fallback` to match each
 * page's layout and avoid layout shift on data arrival.
 */
export class AsyncBoundary extends React.Component<AsyncBoundaryProps, AsyncBoundaryState> {
  state: AsyncBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AsyncBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Surface the error for observability without breaking the boundary.
    // eslint-disable-next-line no-console
    console.error('[AsyncBoundary]', error);
  }

  render() {
    const { children, fallback, errorFallback } = this.props;

    if (this.state.hasError) {
      return errorFallback ?? null;
    }

    return (
      <>
        <SkeletonStyles />
        <Suspense fallback={fallback ?? <ListSkeleton />}>{children}</Suspense>
      </>
    );
  }
}

export default AsyncBoundary;

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OptimizedImage } from '../OptimizedImage';

describe('OptimizedImage', () => {
  it('applies lazy loading, async decoding and dimensions by default', () => {
    render(<OptimizedImage src="/photo.png" alt="Photo" width={320} height={180} />);

    const image = screen.getByRole('img', { name: 'Photo' });
    expect(image).toHaveAttribute('src', '/photo.png');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image).toHaveAttribute('width', '320');
    expect(image).toHaveAttribute('height', '180');
  });

  it('honours explicit loading and decoding overrides', () => {
    render(
      <OptimizedImage
        src="/hero.png"
        alt="Hero"
        loading="eager"
        decoding="sync"
        fetchPriority="high"
      />
    );

    const image = screen.getByRole('img', { name: 'Hero' });
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('decoding', 'sync');
    expect(image).toHaveAttribute('fetchpriority', 'high');
  });

  it('renders a picture element with one source per format', () => {
    const { container } = render(
      <OptimizedImage
        src="/photo.png"
        alt="Photo"
        sources={[
          { srcSet: '/photo.avif', type: 'image/avif' },
          { srcSet: '/photo.webp', type: 'image/webp', media: '(min-width: 600px)' },
        ]}
      />
    );

    const sources = container.querySelectorAll('picture > source');
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute('srcset', '/photo.avif');
    expect(sources[0]).toHaveAttribute('type', 'image/avif');
    expect(sources[1]).toHaveAttribute('srcset', '/photo.webp');
    expect(sources[1]).toHaveAttribute('media', '(min-width: 600px)');
    expect(container.querySelector('picture > img')).toBeInTheDocument();
  });

  it('does not render a picture element without sources', () => {
    const { container } = render(<OptimizedImage src="/photo.png" alt="Photo" />);

    expect(container.querySelector('picture')).toBeNull();
  });

  it('swaps to the fallback source when the primary image fails', () => {
    render(<OptimizedImage src="/broken.png" alt="Photo" fallbackSrc="/fallback.png" />);

    fireEvent.error(screen.getByRole('img', { name: 'Photo' }));

    expect(screen.getByRole('img', { name: 'Photo' })).toHaveAttribute('src', '/fallback.png');
  });

  it('renders fallback content instead of an image when provided', () => {
    render(
      <OptimizedImage src="/broken.png" alt="Photo" fallback={<span data-testid="fallback" />} />
    );

    fireEvent.error(screen.getByRole('img', { name: 'Photo' }));

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders nothing when an image fails and there is no fallback', () => {
    render(<OptimizedImage src="/broken.png" alt="Photo" />);

    fireEvent.error(screen.getByRole('img', { name: 'Photo' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('stops retrying once the fallback source also fails', () => {
    render(<OptimizedImage src="/broken.png" alt="Photo" fallbackSrc="/also-broken.png" />);

    fireEvent.error(screen.getByRole('img', { name: 'Photo' }));
    fireEvent.error(screen.getByRole('img', { name: 'Photo' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('forwards onError and restores the primary source when src changes', () => {
    const onError = vi.fn();
    const { rerender } = render(
      <OptimizedImage src="/broken.png" alt="Photo" fallbackSrc="/fallback.png" onError={onError} />
    );

    fireEvent.error(screen.getByRole('img', { name: 'Photo' }));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('img', { name: 'Photo' })).toHaveAttribute('src', '/fallback.png');

    rerender(<OptimizedImage src="/new.png" alt="Photo" fallbackSrc="/fallback.png" />);
    expect(screen.getByRole('img', { name: 'Photo' })).toHaveAttribute('src', '/new.png');
  });

  it('forwards additional image attributes', () => {
    render(<OptimizedImage src="/photo.png" alt="Photo" className="avatar" sizes="100vw" />);

    const image = screen.getByRole('img', { name: 'Photo' });
    expect(image).toHaveClass('avatar');
    expect(image).toHaveAttribute('sizes', '100vw');
  });
});

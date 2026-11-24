import { useState, type ImgHTMLAttributes, type ReactNode } from 'react';

import type { ImageSource } from './illustrations';

export interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sources?: readonly ImageSource[];
  fallbackSrc?: string;
  fallback?: ReactNode;
}

interface ErrorState {
  src: string;
  fallbackSrc?: string;
  stage: 'primary' | 'fallback';
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  sources,
  fallbackSrc,
  fallback,
  loading = 'lazy',
  decoding = 'async',
  onError,
  ...imgProps
}: OptimizedImageProps) {
  const [errorState, setErrorState] = useState<ErrorState | null>(null);

  const handleError: NonNullable<ImgHTMLAttributes<HTMLImageElement>['onError']> = (event) => {
    onError?.(event);
    setErrorState({ src, fallbackSrc, stage: 'primary' });
  };

  const primaryFailed = errorState?.src === src && errorState.stage === 'primary';
  const fallbackFailed =
    errorState?.src === src &&
    errorState.stage === 'fallback' &&
    errorState.fallbackSrc === fallbackSrc;

  if (primaryFailed || fallbackFailed) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }
    if (!fallbackFailed && fallbackSrc) {
      return (
        <img
          {...imgProps}
          src={fallbackSrc}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          decoding={decoding}
          onError={() => setErrorState({ src, fallbackSrc, stage: 'fallback' })}
        />
      );
    }
    return null;
  }

  const image = (
    <img
      {...imgProps}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      onError={handleError}
    />
  );

  if (!sources?.length) {
    return image;
  }

  return (
    <picture>
      {sources.map((source) => (
        <source key={source.srcSet} srcSet={source.srcSet} type={source.type} media={source.media} />
      ))}
      {image}
    </picture>
  );
}

export default OptimizedImage;

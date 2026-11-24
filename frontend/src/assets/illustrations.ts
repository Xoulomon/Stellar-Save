import errorIllustrationPng from '../img/something_went_wrong.png';
import errorIllustrationWebp from '../img/something_went_wrong.png?format=webp&as=url';
import notFoundIllustrationSvg from '../svg/page-not-found.svg';

export interface ImageSource {
  srcSet: string;
  type: string;
  media?: string;
}

export interface IllustrationAsset {
  src: string;
  alt: string;
  width: number;
  height: number;
  sources?: readonly ImageSource[];
  loading?: 'lazy' | 'eager';
}

export const errorIllustration: IllustrationAsset = {
  src: errorIllustrationPng,
  alt: 'Error Illustration',
  width: 512,
  height: 512,
  sources: [{ srcSet: errorIllustrationWebp, type: 'image/webp' }],
  loading: 'lazy',
};

export const notFoundIllustration: IllustrationAsset = {
  src: notFoundIllustrationSvg,
  alt: '404 Illustration',
  width: 2000,
  height: 2000,
  loading: 'lazy',
};

export const illustrations = {
  error: errorIllustration,
  notFound: notFoundIllustration,
} as const;

/**
 * Shared design tokens.
 *
 * Single source of truth for colors, spacing, radii, typography and
 * breakpoints used across packages. Consumers should import from this
 * module instead of re-declaring token literals locally.
 */

export type ColorTokens = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  danger: string;
  success: string;
};

export type SpacingTokens = {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
};

export type RadiusTokens = {
  sm: string;
  md: string;
  lg: string;
  full: string;
};

export type TypographyTokens = {
  fontFamily: string;
  fontSizeSm: string;
  fontSizeMd: string;
  fontSizeLg: string;
  fontWeightRegular: number;
  fontWeightMedium: number;
  fontWeightBold: number;
  lineHeight: number;
};

export type BreakpointTokens = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
};

export type DesignTokens = {
  color: ColorTokens;
  spacing: SpacingTokens;
  radius: RadiusTokens;
  typography: TypographyTokens;
  breakpoint: BreakpointTokens;
};

export const colors: ColorTokens = {
  background: '#ffffff',
  surface: '#f5f5f5',
  border: '#e0e0e0',
  text: '#1a1a1a',
  textMuted: '#6b6b6b',
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  danger: '#dc2626',
  success: '#16a34a',
};

export const spacing: SpacingTokens = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
};

export const radius: RadiusTokens = {
  sm: '4px',
  md: '8px',
  lg: '16px',
  full: '9999px',
};

export const typography: TypographyTokens = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontSizeSm: '12px',
  fontSizeMd: '14px',
  fontSizeLg: '18px',
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
  lineHeight: 1.5,
};

export const breakpoints: BreakpointTokens = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export const tokens: DesignTokens = {
  color: colors,
  spacing,
  radius,
  typography,
  breakpoint: breakpoints,
};

export type TokenGroup = keyof DesignTokens;

/**
 * Resolve a token value by dotted path, e.g. `resolveToken('color.primary')`.
 * Throws a descriptive error when the group or token key is unknown so
 * callers fail fast instead of silently rendering `undefined`.
 */
export function resolveToken(path: string): string | number {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('resolveToken: path must be a non-empty string');
  }

  const [group, key, ...rest] = path.split('.');

  if (rest.length > 0) {
    throw new Error(`resolveToken: unsupported nested path "${path}"`);
  }

  if (!Object.prototype.hasOwnProperty.call(tokens, group)) {
    throw new Error(`resolveToken: unknown token group "${group}"`);
  }

  const groupTokens = tokens[group as TokenGroup] as Record<string, string | number>;

  if (!Object.prototype.hasOwnProperty.call(groupTokens, key)) {
    throw new Error(`resolveToken: unknown token "${path}"`);
  }

  return groupTokens[key];
}

/**
 * Build a CSS custom-property map from the shared tokens so consumers can
 * inject them into a stylesheet or inline style without duplicating values.
 */
export function toCssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const group of Object.keys(tokens) as TokenGroup[]) {
    const groupTokens = tokens[group] as Record<string, string | number>;
    for (const key of Object.keys(groupTokens)) {
      vars[`--${group}-${key}`] = String(groupTokens[key]);
    }
  }

  return vars;
}

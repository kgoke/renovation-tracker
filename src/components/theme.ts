import { useColorScheme } from 'react-native';

/**
 * App-wide design tokens. Deep green + warm amber over calm neutrals,
 * with full light/dark support.
 */

export const Palette = {
  light: {
    background: '#F6F7F5',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF1EE',
    border: '#E2E6E1',
    text: '#171D1A',
    textSecondary: '#5C6660',
    textMuted: '#8A948D',
    primary: '#1B5E4F',
    onPrimary: '#FFFFFF',
    primarySoft: '#DCEDE7',
    accent: '#B7791F',
    accentSoft: '#F7EBD7',
    danger: '#B3261E',
    dangerSoft: '#F9DEDC',
    success: '#2E7D32',
    successSoft: '#DFF0E0',
    warning: '#9A6700',
    warningSoft: '#FFF3D6',
  },
  dark: {
    background: '#111514',
    surface: '#1B211F',
    surfaceAlt: '#242B28',
    border: '#2E3733',
    text: '#E7EBE8',
    textSecondary: '#A8B3AC',
    textMuted: '#78827B',
    primary: '#66B8A3',
    onPrimary: '#0B2B23',
    primarySoft: '#1E3B34',
    accent: '#E2B366',
    accentSoft: '#3A2F1B',
    danger: '#F2B8B5',
    dangerSoft: '#4A2320',
    success: '#8ED08F',
    successSoft: '#1E3B22',
    warning: '#F0C86A',
    warningSoft: '#3E3013',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Palette.light]: string };

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Palette.dark : Palette.light;
}

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const Type = {
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  subheading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  stat: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.5 },
} as const;

/** Stable categorical colors for charts (expense/cost categories). */
export const ChartColors = [
  '#1B5E4F',
  '#B7791F',
  '#4C7BD9',
  '#A5527A',
  '#5B8C5A',
  '#C05F33',
  '#6B5CA5',
  '#3D8FA8',
  '#8A6F4D',
] as const;

import { useColorScheme } from 'react-native';

// Grayscale on purpose: brand colors are still an open decision (see PRD section 19).
const palette = {
  light: { bg: '#FFFFFF', surface: '#F3F3F3', border: '#DADADA', text: '#111111', muted: '#6B6B6B', primary: '#222222', onPrimary: '#FFFFFF', track: '#E4E4E4' },
  dark: { bg: '#0E0E0E', surface: '#1B1B1B', border: '#333333', text: '#F2F2F2', muted: '#9A9A9A', primary: '#F2F2F2', onPrimary: '#111111', track: '#2C2C2C' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;

export function useTheme() {
  const scheme = useColorScheme();
  return { c: palette[scheme === 'dark' ? 'dark' : 'light'], spacing, radius };
}

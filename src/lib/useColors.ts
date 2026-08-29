import { useColorScheme } from 'react-native';
import { colors, type Colors } from '@/theme';

/** Resolves the active palette. Defaults to dark when the OS reports nothing. */
export function useColors(): Colors {
  const scheme = useColorScheme();
  return scheme === 'light' ? colors.light : colors.dark;
}

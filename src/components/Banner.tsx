import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../theme';

type BannerTone = 'error' | 'info' | 'success';

interface BannerProps {
  message: string | null;
  tone?: BannerTone;
  testID?: string;
}

/** A short status message. Renders nothing when there is no message, so callers can pass state directly. */
export function Banner({ message, tone = 'error', testID }: BannerProps) {
  if (message === null || message === '') {
    return null;
  }
  const palette = PALETTES[tone];
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      testID={testID}
      style={[styles.banner, { backgroundColor: palette.background, borderColor: palette.foreground }]}
    >
      <Text style={[styles.text, { color: palette.foreground }]}>{message}</Text>
    </View>
  );
}

const PALETTES: Record<BannerTone, { background: string; foreground: string }> = {
  error: { background: colors.dangerSoft, foreground: colors.danger },
  info: { background: colors.infoSoft, foreground: colors.info },
  success: { background: colors.successSoft, foreground: colors.success },
};

const styles = StyleSheet.create({
  banner: { borderRadius: radius.sm, borderWidth: 1, padding: spacing.md },
  text: { fontSize: fontSize.sm, lineHeight: 18 },
});

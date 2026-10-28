import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontSize, radius, spacing } from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Shows a spinner in place of the label and disables presses. */
  busy?: boolean;
  /** Read by screen readers after the label, for example what the press leads to. */
  accessibilityHint?: string;
  testID?: string;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, busy = false, accessibilityHint, testID }: ButtonProps) {
  const inactive = disabled || busy;
  const palette = PALETTES[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      onPress={onPress}
      disabled={inactive}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={palette.foreground} />
      ) : (
        <Text style={[styles.label, { color: palette.foreground }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const PALETTES: Record<ButtonVariant, { background: string; foreground: string; border: string }> = {
  primary: { background: colors.primary, foreground: colors.onPrimary, border: colors.primary },
  secondary: { background: colors.surface, foreground: colors.text, border: colors.border },
  danger: { background: colors.surface, foreground: colors.danger, border: colors.danger },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: fontSize.md, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.5 },
});

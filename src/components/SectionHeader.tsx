import { StyleSheet, Text } from 'react-native';

import { colors, fontSize, spacing } from '../theme';

interface SectionHeaderProps {
  title: string;
  count: number;
}

export function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <Text style={styles.header} accessibilityRole="header">
      {title} ({count})
    </Text>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: colors.background,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
});

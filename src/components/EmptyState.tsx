import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, spacing } from '../theme';

interface EmptyStateProps {
  title: string;
  hint?: string;
}

export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      {hint !== undefined ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, textAlign: 'center' },
  hint: { fontSize: fontSize.md, color: colors.muted, textAlign: 'center' },
});

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, spacing } from '../theme';

interface DetailRowProps {
  label: string;
  /** A string is rendered as text; anything else (for example a badge) is rendered as is. */
  value: ReactNode;
}

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={styles.value} selectable>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  label: { fontSize: fontSize.sm, color: colors.muted },
  value: { fontSize: fontSize.md, color: colors.text, flexShrink: 1, textAlign: 'right' },
});

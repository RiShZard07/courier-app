import { StyleSheet, Text, View } from 'react-native';

import type { HealthState } from '../hooks/useHealth';
import { colors, fontSize, spacing } from '../theme';

interface HealthIndicatorProps {
  health: HealthState;
}

const DOT_COLORS = { checking: colors.muted, ok: colors.success, down: colors.danger } as const;

function describe(health: HealthState): string {
  switch (health.status) {
    case 'checking':
      return 'Checking API';
    case 'ok':
      return 'API reachable';
    case 'down':
      return `API unreachable: ${health.message ?? 'unknown reason'}`;
  }
}

/** A colored dot plus one line of text, driven by the health poll. */
export function HealthIndicator({ health }: HealthIndicatorProps) {
  const checked = health.checkedAt === null ? '' : ` (checked ${health.checkedAt.toLocaleTimeString()})`;
  return (
    <View style={styles.row} accessibilityLabel={`API status: ${health.status}`} testID="health-indicator">
      <View style={[styles.dot, { backgroundColor: DOT_COLORS[health.status] }]} />
      <Text style={styles.text}>
        {describe(health)}
        {checked}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { fontSize: fontSize.sm, color: colors.muted, flexShrink: 1 },
});

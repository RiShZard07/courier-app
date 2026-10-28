import { StyleSheet, Text, View } from 'react-native';

import type { OrderState } from '../api/types';
import { stateLabel } from '../domain/orderActions';
import { fontSize, radius, spacing, stateColors } from '../theme';

interface StateBadgeProps {
  state: OrderState;
}

export function StateBadge({ state }: StateBadgeProps) {
  const palette = stateColors[state];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.text, { color: palette.foreground }]}>{stateLabel(state)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignSelf: 'flex-start' },
  text: { fontSize: fontSize.sm, fontWeight: '600' },
});

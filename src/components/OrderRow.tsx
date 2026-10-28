import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Order } from '../api/types';
import { formatCents } from '../domain/money';
import { colors, fontSize, radius, spacing } from '../theme';
import { StateBadge } from './StateBadge';

interface OrderRowProps {
  order: Order;
  onPress: (orderId: string) => void;
}

export function OrderRow({ order, onPress }: OrderRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.id}`}
      testID={`order-row-${order.id}`}
      onPress={() => onPress(order.id)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <Text style={styles.id} numberOfLines={1}>
          {order.id}
        </Text>
        <Text style={styles.merchant} numberOfLines={1}>
          {order.merchant_id}
        </Text>
      </View>
      <View style={styles.side}>
        <Text style={styles.amount}>{formatCents(order.subtotal_cents)}</Text>
        <StateBadge state={order.state} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  pressed: { opacity: 0.8 },
  main: { flex: 1, gap: spacing.xs },
  side: { alignItems: 'flex-end', gap: spacing.xs },
  id: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  merchant: { fontSize: fontSize.sm, color: colors.muted },
  amount: { fontSize: fontSize.md, color: colors.text },
});

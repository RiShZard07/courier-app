import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { toApiError } from '../api/client';
import type { Order, OrderEvent, OrderItem } from '../api/types';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DetailRow } from '../components/DetailRow';
import { Screen } from '../components/Screen';
import { StateBadge } from '../components/StateBadge';
import { formatCents } from '../domain/money';
import { isTerminalState, nextCourierAction, stateLabel, type OrderAction } from '../domain/orderActions';
import { formatTimestamp } from '../domain/time';
import { useOrderDetail } from '../hooks/useOrderDetail';
import { useApi } from '../state/ApiContext';
import { colors, fontSize, monospace, spacing } from '../theme';

interface OrderDetailScreenProps {
  orderId: string;
}

interface Notice {
  tone: 'error' | 'success' | 'info';
  text: string;
}

export const CONFLICT_MESSAGE =
  'This order changed on the server after you loaded it. It has been reloaded; check its state before acting again.';

/** One order: items, state, audit trail and the single legal next action for a courier. */
export function OrderDetailScreen({ orderId }: OrderDetailScreenProps) {
  const client = useApi();
  const { order, events, loading, error, reload, applyTransitionResult } = useOrderDetail(orderId);
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const action = order === null ? null : nextCourierAction(order.state);

  const act = async () => {
    if (order === null || action === null) {
      return;
    }
    setActing(true);
    setNotice(null);
    try {
      // If-Match carries the version we rendered, so a move made elsewhere in the meantime is refused.
      const updated = await client.transitionOrder(order.id, action.transition, order.version);
      await applyTransitionResult(updated);
      setNotice({ tone: 'success', text: `Order is now ${stateLabel(updated.state).toLowerCase()}.` });
    } catch (caught) {
      const apiError = toApiError(caught);
      if (apiError.isVersionConflict) {
        await reload();
        setNotice({ tone: 'info', text: CONFLICT_MESSAGE });
      } else {
        setNotice({ tone: 'error', text: apiError.message });
      }
    } finally {
      setActing(false);
    }
  };

  if (order === null) {
    return (
      <Screen>
        <Banner message={error} testID="order-error" />
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Banner message={notice?.text ?? null} tone={notice?.tone ?? 'error'} testID="order-notice" />
      <Banner message={error} testID="order-error" />

      <Card>
        <Text style={styles.orderId} selectable>
          {order.id}
        </Text>
        <DetailRow label="State" value={<StateBadge state={order.state} />} />
        <DetailRow label="Merchant" value={order.merchant_id} />
        <DetailRow label="Customer" value={order.customer_id} />
        <DetailRow label="Courier" value={order.courier_id ?? 'not assigned'} />
        <DetailRow label="Subtotal" value={formatCents(order.subtotal_cents)} />
        <DetailRow label="Version" value={String(order.version)} />
        <DetailRow label="Updated" value={formatTimestamp(order.updated_at)} />
        <ActionArea order={order} action={action} busy={acting || loading} onPress={() => void act()} />
      </Card>

      <Card title={`Items (${order.items.length})`}>
        {order.items.map((item, index) => (
          <ItemRow key={`${item.sku}-${index}`} item={item} />
        ))}
      </Card>

      <Card title="History">
        {events.length === 0 ? <Text style={styles.muted}>No events recorded.</Text> : null}
        {events.map((event) => (
          <EventRow key={event.seq} event={event} />
        ))}
      </Card>
    </Screen>
  );
}

interface ActionAreaProps {
  order: Order;
  action: OrderAction | null;
  busy: boolean;
  onPress: () => void;
}

function ActionArea({ order, action, busy, onPress }: ActionAreaProps) {
  if (action !== null) {
    return (
      <Button
        label={action.label}
        accessibilityHint={`Moves the order to ${stateLabel(action.nextState)}`}
        onPress={onPress}
        busy={busy}
        testID="order-action"
      />
    );
  }
  const text = isTerminalState(order.state) ? 'No further action: this order is closed.' : 'Waiting for dispatch to assign this order.';
  return <Text style={styles.muted}>{text}</Text>;
}

function ItemRow({ item }: { item: OrderItem }) {
  return (
    <View style={styles.itemRow}>
      <Text style={styles.itemSku}>{item.sku}</Text>
      <Text style={styles.muted}>
        {item.quantity} x {formatCents(item.unit_price_cents)}
      </Text>
      <Text style={styles.itemTotal}>{formatCents(item.quantity * item.unit_price_cents)}</Text>
    </View>
  );
}

function EventRow({ event }: { event: OrderEvent }) {
  const from = event.from_state === null ? 'new' : stateLabel(event.from_state);
  return (
    <View style={styles.eventRow} testID={`event-${event.seq}`}>
      <Text style={styles.eventSeq}>#{event.seq}</Text>
      <View style={styles.eventBody}>
        <Text style={styles.eventTitle}>
          {from} to {stateLabel(event.to_state)}
        </Text>
        <Text style={styles.muted}>
          {event.actor} at {formatTimestamp(event.created_at)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  orderId: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, fontFamily: monospace },
  muted: { fontSize: fontSize.sm, color: colors.muted },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemSku: { flex: 1, fontSize: fontSize.md, color: colors.text },
  itemTotal: { fontSize: fontSize.md, color: colors.text, fontWeight: '600' },
  eventRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  eventSeq: { width: 32, fontSize: fontSize.sm, color: colors.muted, fontFamily: monospace },
  eventBody: { flex: 1, gap: 2 },
  eventTitle: { fontSize: fontSize.md, color: colors.text },
});

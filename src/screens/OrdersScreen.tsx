import { useMemo } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';

import { Banner } from '../components/Banner';
import { EmptyState } from '../components/EmptyState';
import { OrderRow } from '../components/OrderRow';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { groupOrdersByState } from '../domain/orderActions';
import { useCourierOrders } from '../hooks/useCourierOrders';
import { useSettings } from '../state/SettingsContext';
import { colors, spacing } from '../theme';

interface OrdersScreenProps {
  onOpenOrder: (orderId: string) => void;
  /** Increment to reload (the tab passes its refocus token). */
  refreshToken?: number;
}

/** Orders assigned to this courier, grouped by state, with pull to refresh. */
export function OrdersScreen({ onOpenOrder, refreshToken = 0 }: OrdersScreenProps) {
  const { settings } = useSettings();
  const courierId = settings.courier?.id ?? null;
  const { orders, loading, refreshing, error, refresh } = useCourierOrders(courierId, refreshToken);
  const sections = useMemo(() => groupOrdersByState(orders), [orders]);

  if (courierId === null) {
    return (
      <Screen>
        <EmptyState title="No courier yet" hint="Register or choose a courier on the Setup tab to see your orders." />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <SectionList
        testID="orders-list"
        sections={sections}
        keyExtractor={(order) => order.id}
        renderItem={({ item }) => <OrderRow order={item} onPress={onOpenOrder} />}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} count={section.data.length} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={<Banner message={error} testID="orders-error" />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          ) : (
            <EmptyState title="No orders yet" hint="Orders assigned to you by dispatch will appear here. Pull down to refresh." />
          )
        }
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  separator: { height: spacing.sm },
  spinner: { marginTop: spacing.xl },
});

import { Stack, useLocalSearchParams } from 'expo-router';

import { EmptyState } from '../../src/components/EmptyState';
import { Screen } from '../../src/components/Screen';
import { OrderDetailScreen } from '../../src/screens/OrderDetailScreen';

export default function OrderDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const orderId = Array.isArray(id) ? id[0] : id;
  if (orderId === undefined || orderId === '') {
    return (
      <Screen>
        <EmptyState title="No order id in the link" />
      </Screen>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: orderId }} />
      <OrderDetailScreen orderId={orderId} />
    </>
  );
}

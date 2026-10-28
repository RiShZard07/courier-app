import { useRouter } from 'expo-router';

import { useRefocusToken } from '../../src/hooks/useRefocusToken';
import { OrdersScreen } from '../../src/screens/OrdersScreen';

export default function OrdersRoute() {
  const router = useRouter();
  const refreshToken = useRefocusToken();
  return <OrdersScreen refreshToken={refreshToken} onOpenOrder={(orderId) => router.push(`/orders/${orderId}`)} />;
}

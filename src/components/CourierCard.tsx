import { StyleSheet, Text, View } from 'react-native';

import type { CourierIdentity } from '../state/settings';
import { colors, fontSize, monospace, spacing } from '../theme';

interface CourierCardProps {
  courier: CourierIdentity;
}

/** The courier this device acts as, as saved on the Setup screen. */
export function CourierCard({ courier }: CourierCardProps) {
  return (
    <View style={styles.wrapper} testID="courier-card">
      <Text style={styles.name}>{courier.name}</Text>
      <Text style={styles.id} selectable>
        {courier.id}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  name: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  id: { fontSize: fontSize.sm, color: colors.muted, fontFamily: monospace },
});

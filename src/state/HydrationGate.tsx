import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '../theme';
import { useSettings } from './SettingsContext';

/** Hold rendering until saved settings are read, so no request goes to the wrong API URL. */
export function HydrationGate({ children }: { children: ReactNode }) {
  const { hydrated } = useSettings();
  if (!hydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ApiProvider } from '../src/state/ApiContext';
import { HydrationGate } from '../src/state/HydrationGate';
import { SettingsProvider } from '../src/state/SettingsContext';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <HydrationGate>
        <ApiProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="orders/[id]" options={{ title: 'Order' }} />
          </Stack>
        </ApiProvider>
      </HydrationGate>
    </SettingsProvider>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '../../src/theme';

type IconName = 'list-outline' | 'bicycle-outline' | 'settings-outline';

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: string; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'My orders', tabBarIcon: tabIcon('list-outline') }} />
      <Tabs.Screen name="shift" options={{ title: 'Shift', tabBarIcon: tabIcon('bicycle-outline') }} />
      <Tabs.Screen name="setup" options={{ title: 'Setup', tabBarIcon: tabIcon('settings-outline') }} />
    </Tabs>
  );
}

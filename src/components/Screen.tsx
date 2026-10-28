import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors, spacing } from '../theme';

interface ScreenProps {
  children: ReactNode;
  /** When false the children own scrolling (for example a SectionList). */
  scroll?: boolean;
}

/** Page background and padding shared by every screen. */
export function Screen({ children, scroll = true }: ScreenProps) {
  if (!scroll) {
    return <View style={styles.fill}>{children}</View>;
  }
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
});

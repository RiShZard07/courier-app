import { Link, Stack } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { EmptyState } from '../src/components/EmptyState';
import { Screen } from '../src/components/Screen';
import { colors, fontSize } from '../src/theme';

export default function NotFoundRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <EmptyState title="This page does not exist" />
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back to my orders</Text>
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center' },
  linkText: { color: colors.primary, fontSize: fontSize.md },
});

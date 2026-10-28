import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

/**
 * A counter that increments each time the screen regains focus (not on the first focus, which
 * coincides with mount). Screens pass it to their data hooks so tabs refresh when revisited.
 */
export function useRefocusToken(): number {
  const [token, setToken] = useState(0);
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setToken((current) => current + 1);
    }, []),
  );
  return token;
}

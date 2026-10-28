import { act } from '@testing-library/react-native';

/**
 * Flush React's pending passive effects.
 *
 * `findBy*` resolves outside of `act`, so after a load completes a Pressable whose `disabled`
 * prop just flipped may not have applied it yet (Pressability reads the prop in an effect). A
 * press fired at that instant is ignored. Awaiting an empty act scope flushes the effects first.
 */
export async function flushEffects(): Promise<void> {
  await act(async () => {});
}

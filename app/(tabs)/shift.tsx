import { useRefocusToken } from '../../src/hooks/useRefocusToken';
import { ShiftScreen } from '../../src/screens/ShiftScreen';

export default function ShiftRoute() {
  const refreshToken = useRefocusToken();
  return <ShiftScreen refreshToken={refreshToken} />;
}

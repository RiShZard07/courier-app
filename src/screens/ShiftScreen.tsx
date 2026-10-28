import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { toApiError } from '../api/client';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { CourierCard } from '../components/CourierCard';
import { DetailRow } from '../components/DetailRow';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { HealthIndicator } from '../components/HealthIndicator';
import { Screen } from '../components/Screen';
import { formatCoordinate, parseLocation } from '../domain/coordinates';
import { useCourier } from '../hooks/useCourier';
import { useHealth } from '../hooks/useHealth';
import { getDeviceLocation } from '../location/getDeviceLocation';
import { useApi } from '../state/ApiContext';
import { useSettings } from '../state/SettingsContext';
import { colors, fontSize, spacing } from '../theme';

type Task = 'availability' | 'device-location' | 'send-location' | null;

interface Notice {
  tone: 'error' | 'success' | 'info';
  text: string;
}

interface ShiftScreenProps {
  /** Increment to re-read the courier from the server (the tab passes its refocus token). */
  refreshToken?: number;
}

/** Go on or off shift and report a position. The health poll runs whenever this screen is mounted. */
export function ShiftScreen({ refreshToken = 0 }: ShiftScreenProps) {
  const client = useApi();
  const { settings } = useSettings();
  const health = useHealth();
  const courierId = settings.courier?.id ?? null;
  const { courier, loading, error, apply } = useCourier(courierId, refreshToken);
  const [latDraft, setLatDraft] = useState('');
  const [lngDraft, setLngDraft] = useState('');
  const [task, setTask] = useState<Task>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Start the manual form from the position the server last recorded.
  useEffect(() => {
    if (courier !== null) {
      setLatDraft(formatCoordinate(courier.lat));
      setLngDraft(formatCoordinate(courier.lng));
    }
  }, [courier]);

  const setAvailability = async (available: boolean) => {
    if (courierId === null) {
      return;
    }
    setTask('availability');
    try {
      apply(await client.setCourierAvailability(courierId, available));
      setNotice({ tone: 'success', text: available ? 'You are on shift and can be assigned orders.' : 'You are off shift.' });
    } catch (caught) {
      setNotice({ tone: 'error', text: toApiError(caught).message });
    } finally {
      setTask(null);
    }
  };

  const sendLocation = async (latText: string, lngText: string) => {
    if (courierId === null) {
      return;
    }
    const parsed = parseLocation(latText, lngText);
    if (!parsed.ok) {
      setNotice({ tone: 'error', text: parsed.message });
      return;
    }
    setTask('send-location');
    try {
      const updated = await client.setCourierLocation(courierId, parsed.location);
      apply(updated);
      setNotice({ tone: 'success', text: `Location sent: ${formatCoordinate(updated.lat)}, ${formatCoordinate(updated.lng)}.` });
    } catch (caught) {
      setNotice({ tone: 'error', text: toApiError(caught).message });
    } finally {
      setTask(null);
    }
  };

  const sendDeviceLocation = async () => {
    setTask('device-location');
    const result = await getDeviceLocation();
    setTask(null);
    if (!result.ok) {
      setNotice({ tone: 'info', text: result.reason });
      return;
    }
    const lat = formatCoordinate(result.location.lat);
    const lng = formatCoordinate(result.location.lng);
    setLatDraft(lat);
    setLngDraft(lng);
    await sendLocation(lat, lng);
  };

  return (
    <Screen>
      <Card>
        <HealthIndicator health={health} />
      </Card>

      {settings.courier === null ? (
        <EmptyState title="No courier yet" hint="Register or choose a courier on the Setup tab." />
      ) : (
        <>
          <Banner message={notice?.text ?? null} tone={notice?.tone ?? 'error'} testID="shift-notice" />
          <Banner message={error} testID="shift-error" />

          <Card title="Shift">
            <CourierCard courier={settings.courier} />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{courier?.available ? 'On shift (available)' : 'Off shift'}</Text>
              <Switch
                accessibilityLabel="Available for orders"
                testID="availability-switch"
                value={courier?.available ?? false}
                disabled={courier === null || task !== null}
                onValueChange={(next) => void setAvailability(next)}
              />
            </View>
            {loading && courier === null ? <Text style={styles.hint}>Loading courier...</Text> : null}
            {courier !== null ? <DetailRow label="Server version" value={String(courier.version)} /> : null}
          </Card>

          <Card title="Location">
            {courier !== null ? (
              <DetailRow label="Last sent" value={`${formatCoordinate(courier.lat)}, ${formatCoordinate(courier.lng)}`} />
            ) : null}
            <Button
              label="Use device location"
              onPress={() => void sendDeviceLocation()}
              busy={task === 'device-location'}
              disabled={courier === null || (task !== null && task !== 'device-location')}
            />
            <Text style={styles.hint}>Or enter coordinates by hand:</Text>
            <Field label="Latitude" value={latDraft} onChangeText={setLatDraft} placeholder="40.4406" keyboardType="numbers-and-punctuation" testID="lat-input" />
            <Field label="Longitude" value={lngDraft} onChangeText={setLngDraft} placeholder="-79.9959" keyboardType="numbers-and-punctuation" testID="lng-input" />
            <Button
              label="Send location"
              variant="secondary"
              onPress={() => void sendLocation(latDraft, lngDraft)}
              busy={task === 'send-location'}
              disabled={courier === null || (task !== null && task !== 'send-location')}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  toggleLabel: { fontSize: fontSize.md, color: colors.text },
  hint: { fontSize: fontSize.sm, color: colors.muted },
});

import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { toApiError } from '../api/client';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { CourierCard } from '../components/CourierCard';
import { Field } from '../components/Field';
import { Screen } from '../components/Screen';
import { useApi } from '../state/ApiContext';
import { parseBaseUrl } from '../state/settings';
import { useSettings } from '../state/SettingsContext';
import { colors, fontSize } from '../theme';

type Task = 'url' | 'register' | 'existing' | null;

interface Notice {
  tone: 'error' | 'success';
  text: string;
}

/** Where the API is and which courier this device acts as. Both are persisted. */
export function SetupScreen() {
  const client = useApi();
  const { settings, setBaseUrl, setCourier } = useSettings();
  const [urlDraft, setUrlDraft] = useState(settings.baseUrl);
  const [nameDraft, setNameDraft] = useState('');
  const [existingIdDraft, setExistingIdDraft] = useState('');
  const [task, setTask] = useState<Task>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Keep the draft in step with the saved value (it arrives from storage after first render).
  useEffect(() => {
    setUrlDraft(settings.baseUrl);
  }, [settings.baseUrl]);

  const saveUrl = async () => {
    const parsed = parseBaseUrl(urlDraft);
    if (parsed === null) {
      setNotice({ tone: 'error', text: 'Enter a URL starting with http:// or https://, for example http://192.168.1.20:8000.' });
      return;
    }
    setTask('url');
    await setBaseUrl(parsed);
    setTask(null);
    setNotice({ tone: 'success', text: `API URL saved: ${parsed}` });
  };

  const register = async () => {
    const name = nameDraft.trim();
    if (name === '') {
      setNotice({ tone: 'error', text: 'Enter a name for the new courier.' });
      return;
    }
    setTask('register');
    try {
      // Registered off shift at 0,0: the Shift tab sends a real position and turns availability on.
      const courier = await client.createCourier({ name, lat: 0, lng: 0, available: false });
      await setCourier({ id: courier.id, name: courier.name });
      setNameDraft('');
      setNotice({ tone: 'success', text: `Registered ${courier.name} as ${courier.id}.` });
    } catch (error) {
      setNotice({ tone: 'error', text: toApiError(error).message });
    } finally {
      setTask(null);
    }
  };

  const adoptExisting = async () => {
    const id = existingIdDraft.trim();
    if (id === '') {
      setNotice({ tone: 'error', text: 'Paste a courier id such as cur_0123456789abcdef.' });
      return;
    }
    setTask('existing');
    try {
      const courier = await client.getCourier(id);
      await setCourier({ id: courier.id, name: courier.name });
      setExistingIdDraft('');
      setNotice({ tone: 'success', text: `Now acting as ${courier.name} (${courier.id}).` });
    } catch (error) {
      setNotice({ tone: 'error', text: toApiError(error).message });
    } finally {
      setTask(null);
    }
  };

  const forget = async () => {
    await setCourier(null);
    setNotice({ tone: 'success', text: 'Courier cleared on this device. The record still exists on the server.' });
  };

  return (
    <Screen>
      <Banner message={notice?.text ?? null} tone={notice?.tone ?? 'error'} testID="setup-notice" />

      <Card title="API">
        <Field
          label="Base URL"
          value={urlDraft}
          onChangeText={setUrlDraft}
          placeholder="http://192.168.1.20:8000"
          keyboardType="url"
          testID="base-url-input"
        />
        <Text style={styles.hint}>Requests currently go to {client.baseUrl}</Text>
        <Button label="Save URL" variant="secondary" onPress={() => void saveUrl()} busy={task === 'url'} />
      </Card>

      <Card title="Courier">
        {settings.courier === null ? (
          <Text style={styles.hint}>No courier selected yet. Register one below or paste an existing id.</Text>
        ) : (
          <>
            <CourierCard courier={settings.courier} />
            <Button label="Forget courier" variant="danger" onPress={() => void forget()} />
          </>
        )}
      </Card>

      <Card title="Register a new courier">
        <Field label="Name" value={nameDraft} onChangeText={setNameDraft} placeholder="Courier name" autoCapitalize="words" testID="courier-name-input" />
        <Button label="Register" onPress={() => void register()} busy={task === 'register'} disabled={task !== null && task !== 'register'} />
      </Card>

      <Card title="Use an existing courier">
        <Field label="Courier id" value={existingIdDraft} onChangeText={setExistingIdDraft} placeholder="cur_..." testID="courier-id-input" />
        <Button
          label="Use this courier"
          variant="secondary"
          onPress={() => void adoptExisting()}
          busy={task === 'existing'}
          disabled={task !== null && task !== 'existing'}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: fontSize.sm, color: colors.muted },
});

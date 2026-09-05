/**
 * Username picker, shown once after a new account is created.
 *
 * Signup derives a username from the email so nobody is blocked at the form,
 * but that name is ugly and it is what opponents see. Apple Sign-In also
 * returns no reliable display name, so this is the only place a player ever
 * names themselves.
 */

import { useState } from 'react';
import { router } from 'expo-router';
import { TextInput, View } from 'react-native';
import { ApiError, api } from '@/lib/api';
import { useColors } from '@/lib/useColors';
import { Body, Button, ErrorNote, Eyebrow, Screen, Title } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { font, radius, space, TAP_TARGET } from '@/theme';

export default function Username() {
  const c = useColors();
  const current = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [name, setName] = useState(current?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const user = await api.setUsername(name.trim());
      setUser(user);
      router.replace('/home');
    } catch (e) {
      setError(
        e instanceof ApiError
          ? (e.fields?.[0]?.message ?? e.message)
          : 'Could not save that name. Check your connection.',
      );
    } finally {
      setBusy(false);
    }
  };

  const valid = /^[a-zA-Z0-9_]{3,18}$/.test(name.trim());

  return (
    <Screen>
      <View style={{ gap: space.xs, marginTop: space.xxl }}>
        <Eyebrow>ONE LAST THING</Eyebrow>
        <Title>Pick a name</Title>
        <Body muted>This is what your study partners will see. You can change it later.</Body>
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. ada_sabi"
        placeholderTextColor={c.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={18}
        style={{
          minHeight: TAP_TARGET,
          borderWidth: 1,
          borderColor: valid || name === '' ? c.border : c.wrong,
          backgroundColor: c.surface,
          borderRadius: radius.md,
          paddingHorizontal: space.lg,
          color: c.text,
          ...font.option,
        }}
      />

      <Body muted>3–18 characters. Letters, numbers and underscores.</Body>

      {error ? <ErrorNote message={error} /> : null}

      <View style={{ flex: 1 }} />

      <Button label="Save and continue" onPress={save} busy={busy} disabled={!valid} />
      <Button
        label="Keep suggested name"
        variant="ghost"
        onPress={() => router.replace('/home')}
      />
    </Screen>
  );
}

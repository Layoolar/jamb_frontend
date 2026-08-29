/**
 * Password reset, both steps on one screen.
 *
 * A separate "check your email" screen would strand anyone who closes the app
 * to read the code — a phone shows one app at a time, so the code entry has to
 * still be here when they come back.
 */

import { useState } from 'react';
import { router } from 'expo-router';
import { TextInput, View } from 'react-native';
import { ApiError, api } from '@/lib/api';
import { useColors } from '@/lib/useColors';
import { Body, Button, ErrorNote, Eyebrow, Header, Screen, Title } from '@/components/ui';
import { font, radius, space, TAP_TARGET } from '@/theme';

export default function ForgotPassword() {
  const c = useColors();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const input = {
    minHeight: TAP_TARGET,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    color: c.text,
    ...font.body,
  };

  const fail = (e: unknown) =>
    setError(
      e instanceof ApiError
        ? (e.fields?.[0]?.message ?? e.message)
        : 'Could not reach the server. Check your connection.',
    );

  const request = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim());
      setStep('code');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(code.trim(), password);
      setDone(true);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen header={<Header title="Reset password" />}>
        <View style={{ gap: space.xs, marginTop: space.xxl }}>
          <Eyebrow>DONE</Eyebrow>
          <Title>Password changed</Title>
          <Body muted>
            You have been signed out everywhere else. Sign in with your new
            password.
          </Body>
        </View>
        <View style={{ flex: 1 }} />
        <Button label="Sign in" onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen header={<Header title="Reset password" onBack={() => router.back()} />}>
      <View style={{ gap: space.xs, marginTop: space.xxl }}>
        <Eyebrow>ACCOUNT</Eyebrow>
        <Title>Reset password</Title>
        <Body muted>
          {step === 'email'
            ? "Enter your email and we'll send a code."
            : `If ${email} has an account, a code is on its way. It expires in 30 minutes.`}
        </Body>
      </View>

      {step === 'email' ? (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            style={input}
          />
          {error ? <ErrorNote message={error} /> : null}
          <Button
            label="Send code"
            onPress={request}
            busy={busy}
            disabled={!email.includes('@')}
          />
        </View>
      ) : (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="8-digit code"
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
            maxLength={8}
            style={{ ...input, letterSpacing: 4 }}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="New password (10+ characters)"
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
            autoComplete="new-password"
            secureTextEntry
            style={input}
          />
          {error ? <ErrorNote message={error} /> : null}
          <Button
            label="Set new password"
            onPress={reset}
            busy={busy}
            disabled={code.trim().length < 4 || password.length < 10}
          />
          <Button
            label="Send another code"
            variant="ghost"
            onPress={() => {
              setStep('email');
              setError(null);
            }}
          />
        </View>
      )}

      <View style={{ flex: 1 }} />
    </Screen>
  );
}

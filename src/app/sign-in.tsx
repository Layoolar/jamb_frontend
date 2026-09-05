import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { ApiError, api } from '@/lib/api';
import { LEGAL, openLegal } from '@/lib/legal';
import { useColors } from '@/lib/useColors';
import { Body, BrandMark, Button, ErrorNote, Eyebrow, Screen, Title } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { font, radius, space, TAP_TARGET } from '@/theme';

export default function SignIn() {
  const c = useColors();
  const status = useAuth((s) => s.status);
  const setUser = useAuth((s) => s.setUser);
  const { code } = useLocalSearchParams<{ code?: string }>();

  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A duel code arriving via deep link must survive sign-in, not be dropped.
  const nextHref: Href = code ? (`/home?code=${code}` as Href) : '/home';

  if (status === 'signedIn') return <Redirect href={nextHref} />;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r =
        mode === 'signup'
          ? await api.signup(email.trim(), password)
          : await api.login(email.trim(), password);
      setUser(r.user);
      // New accounts get a name derived from their email; let them fix it once.
      router.replace(r.isNewAccount ? '/username' : nextHref);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? (e.fields?.[0]?.message ?? e.message)
          : 'Could not reach the server. Check your connection.',
      );
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    minHeight: TAP_TARGET,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    color: c.text,
    ...font.body,
  };

  return (
    <Screen>
      <View style={{ gap: space.md, marginTop: space.xxl }}>
        <BrandMark size={52} />
        <View style={{ gap: space.xs }}>
          <Eyebrow>JAMB PRACTICE, HEAD TO HEAD</Eyebrow>
          <Title>SabiPass</Title>
          <Body muted>
            Ten questions, fifteen seconds each. Challenge a friend or play solo.
          </Body>
        </View>
      </View>

      <View style={{ gap: space.md, marginTop: space.xl }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={c.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          style={inputStyle}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'signup' ? 'Password (10+ characters)' : 'Password'}
          placeholderTextColor={c.textMuted}
          autoCapitalize="none"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          secureTextEntry
          style={inputStyle}
        />

        {error ? <ErrorNote message={error} /> : null}

        <Button
          label={mode === 'signup' ? 'Create account' : 'Sign in'}
          onPress={submit}
          busy={busy}
          disabled={!email.trim() || password.length < 1}
        />

        <Pressable
          onPress={() => {
            setMode(mode === 'signup' ? 'login' : 'signup');
            setError(null);
          }}
          style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
          accessibilityRole="button"
        >
          <Text style={{ ...font.body, fontSize: 14, color: c.accent }}>
            {mode === 'signup'
              ? 'Already have an account? Sign in'
              : 'New here? Create an account'}
          </Text>
        </Pressable>

        {mode === 'login' ? (
          <Pressable
            onPress={() => router.push('/forgot-password')}
            style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
            accessibilityRole="button"
          >
            <Text style={{ ...font.body, fontSize: 14, color: c.textMuted }}>
              Forgot your password?
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flex: 1 }} />

      {/*
        Google and Apple buttons land in Phase 4 alongside the OAuth client
        registration. Showing dead buttons now would be worse than showing none.
        Apple Sign-In is required on iOS once Google ships (App Store 4.8).
      */}
      <View style={{ gap: space.sm, opacity: 0.5 }}>
        <Body muted>
          {Platform.OS === 'ios'
            ? 'Google and Apple sign-in arrive in the next build.'
            : 'Google sign-in arrives in the next build.'}
        </Body>
      </View>

      {/*
        Full opacity and full contrast on purpose. This is the consent line, so
        it is not decoration to be dimmed alongside the placeholder above.
      */}
      <Text
        style={{
          ...font.body,
          fontSize: 13,
          lineHeight: 19,
          color: c.textMuted,
          textAlign: 'center',
          marginTop: space.md,
        }}
      >
        {mode === 'signup' ? 'By creating an account' : 'By signing in'} you agree to
        our{' '}
        <Text
          accessibilityRole="link"
          onPress={() => openLegal(LEGAL.terms)}
          style={{ color: c.accent }}
        >
          Terms of use
        </Text>
        {' and '}
        <Text
          accessibilityRole="link"
          onPress={() => openLegal(LEGAL.privacy)}
          style={{ color: c.accent }}
        >
          Privacy policy
        </Text>
        .
      </Text>
    </Screen>
  );
}

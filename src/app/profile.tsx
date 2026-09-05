/**
 * Profile and settings.
 *
 * Account deletion lives here and is genuinely reachable — App Store 5.1.1(v)
 * requires it for any app that supports account creation, and burying it is a
 * rejection reason as well as a dark pattern.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Eyebrow,
  Header,
  Loading,
  Screen,
  StatPill,
  Title,
} from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { LEGAL, openLegal } from '@/lib/legal';
import { updateTokens } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { useAuth } from '@/store/auth';
import { font, radius, space, TAP_TARGET } from '@/theme';

export default function Profile() {
  const c = useColors();
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);

  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const blocked = useQuery({ queryKey: ['blocked'], queryFn: api.blockedUsers });

  const [section, setSection] = useState<'none' | 'username' | 'password'>('none');
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const unblock = useMutation({
    mutationFn: (userId: string) => api.unblockUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocked'] });
      setError(null);
      setNotice('Unblocked. They can be matched with you again.');
    },
    onError: fail,
  });

  const saveUsername = useMutation({
    mutationFn: () => api.setUsername(username.trim()),
    onSuccess: (user) => {
      setUser(user);
      qc.invalidateQueries({ queryKey: ['me'] });
      setSection('none');
      setUsername('');
      setError(null);
      setNotice('Username updated.');
    },
    onError: fail,
  });

  const savePassword = useMutation({
    mutationFn: () =>
      api.changePassword(currentPassword || undefined, newPassword),
    onSuccess: async (tokens) => {
      // The server revoked every session and issued this device a fresh pair.
      // Store them or the very next request 401s.
      await updateTokens(tokens.accessToken, tokens.refreshToken);
      qc.invalidateQueries({ queryKey: ['me'] });
      setSection('none');
      setCurrentPassword('');
      setNewPassword('');
      setError(null);
      setNotice('Password changed. Other devices have been signed out.');
    },
    onError: fail,
  });

  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This removes your account, match history and stats permanently. It cannot be undone.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteAccount();
              useAuth.getState().forceSignOut();
              router.replace('/sign-in');
            } catch (e) {
              fail(e);
            }
          },
        },
      ],
    );
  };

  if (me.isLoading) {
    return (
      <Screen scroll={false} header={<Header title="Profile" onHome={() => router.replace('/home')} />}>
        <Loading />
      </Screen>
    );
  }

  const stats = me.data?.stats;
  const hasPassword = me.data?.hasPassword ?? true;
  const linked = me.data?.linkedProviders ?? [];

  return (
    <Screen header={<Header title="Profile" onHome={() => router.replace('/home')} />}>
      <View style={{ gap: space.xs }}>
        <Eyebrow>ACCOUNT</Eyebrow>
        <Title>{me.data?.user.username ?? 'Player'}</Title>
        <Body muted>{me.data?.email}</Body>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <StatPill label="WON" value={String(stats?.wins ?? 0)} />
          <StatPill label="LOST" value={String(stats?.losses ?? 0)} />
          <StatPill label="DREW" value={String(stats?.draws ?? 0)} />
          <StatPill label="BEST" value={String(stats?.bestStreak ?? 0)} />
        </View>
        <Text style={{ ...font.label, color: c.textMuted, textAlign: 'center' }}>
          {stats?.duelsPlayed ?? 0} CHALLENGES PLAYED · STREAK {stats?.streak ?? 0}
        </Text>
      </Card>

      {notice ? (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: c.correct,
            backgroundColor: c.surface,
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
            borderRadius: radius.sm,
          }}
        >
          <Text style={{ ...font.body, fontSize: 14, color: c.text }}>{notice}</Text>
        </View>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}

      {/* -------------------------------------------------------- username */}
      <View style={{ gap: space.sm }}>
        <Row
          label="Username"
          value={me.data?.user.username ?? '—'}
          onPress={() => {
            setUsername(me.data?.user.username ?? '');
            setSection(section === 'username' ? 'none' : 'username');
            setNotice(null);
            setError(null);
          }}
        />
        {section === 'username' ? (
          <View style={{ gap: space.sm }}>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="New username"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={18}
              style={input}
            />
            <Body muted>3–18 characters. Letters, numbers and underscores.</Body>
            <Button
              label="Save username"
              onPress={() => saveUsername.mutate()}
              busy={saveUsername.isPending}
              disabled={!/^[a-zA-Z0-9_]{3,18}$/.test(username.trim())}
            />
          </View>
        ) : null}
      </View>

      {/* -------------------------------------------------------- password */}
      <View style={{ gap: space.sm }}>
        <Row
          label="Password"
          value={hasPassword ? 'Change' : 'Not set'}
          onPress={() => {
            setSection(section === 'password' ? 'none' : 'password');
            setNotice(null);
            setError(null);
          }}
        />
        {section === 'password' ? (
          <View style={{ gap: space.sm }}>
            {hasPassword ? (
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Current password"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                autoComplete="current-password"
                secureTextEntry
                style={input}
              />
            ) : (
              <Body muted>
                You signed in with {linked.join(' and ') || 'a provider'}. Setting a
                password lets you sign in with your email too.
              </Body>
            )}
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password (10+ characters)"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              style={input}
            />
            <Button
              label={hasPassword ? 'Change password' : 'Set password'}
              onPress={() => savePassword.mutate()}
              busy={savePassword.isPending}
              disabled={
                newPassword.length < 10 || (hasPassword && currentPassword.length < 1)
              }
            />
            <Body muted>
              Changing this signs you out everywhere else. You stay signed in here.
            </Body>
          </View>
        ) : null}
      </View>

      <Row
        label="Sign-in methods"
        value={
          [hasPassword ? 'Email' : null, ...linked.map((p) => p === 'google' ? 'Google' : 'Apple')]
            .filter(Boolean)
            .join(', ') || '—'
        }
      />

      {/* --------------------------------------------------------- blocked */}
      {/*
        A block you cannot undo is a trap, so the list is only rendered when it
        has something in it — an empty "Blocked players" header on every profile
        implies a problem most users will never have.
      */}
      {(blocked.data?.blocked.length ?? 0) > 0 ? (
        <View style={{ gap: space.sm }}>
          <Eyebrow>BLOCKED PLAYERS</Eyebrow>
          {blocked.data?.blocked.map((b) => (
            <Row
              key={b.id}
              label={b.username}
              value={unblock.isPending ? '…' : 'Unblock'}
              onPress={() => unblock.mutate(b.id)}
            />
          ))}
          <Body muted>
            Blocked players are never matched with you, by quick challenge or by
            code.
          </Body>
        </View>
      ) : null}

      {/* -------------------------------------------------------- policies */}
      <View style={{ gap: space.sm }}>
        <Eyebrow>LEGAL</Eyebrow>
        <Row label="Privacy policy" value="View" onPress={() => openLegal(LEGAL.privacy)} />
        <Row label="Terms of use" value="View" onPress={() => openLegal(LEGAL.terms)} />
        <Row
          label="Study challenge rules"
          value="View"
          onPress={() => openLegal(LEGAL.rules)}
        />
      </View>

      <View style={{ flex: 1, minHeight: space.xl }} />

      <Button
        label="Sign out"
        variant="secondary"
        onPress={async () => {
          await useAuth.getState().signOut();
          router.replace('/sign-in');
        }}
      />

      <Pressable
        onPress={confirmDelete}
        accessibilityRole="button"
        style={{ minHeight: TAP_TARGET, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ ...font.body, fontSize: 14, color: c.wrong }}>
          Delete my account
        </Text>
      </Pressable>
    </Screen>
  );

  function Row({
    label,
    value,
    onPress,
  }: {
    label: string;
    value: string;
    onPress?: () => void;
  }) {
    const body = (
      <View
        style={{
          minHeight: TAP_TARGET,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.lg,
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radius.md,
        }}
      >
        <Text style={{ ...font.body, color: c.text }}>{label}</Text>
        <Text style={{ ...font.body, color: onPress ? c.accent : c.textMuted }}>
          {value}
        </Text>
      </View>
    );

    return onPress ? (
      <Pressable onPress={onPress} accessibilityRole="button">
        {body}
      </Pressable>
    ) : (
      body
    );
  }
}

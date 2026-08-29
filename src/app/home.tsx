import { useQuery } from '@tanstack/react-query';
import { Link, Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { JoinByCode } from '@/components/JoinByCode';
import { api } from '@/lib/api';
import { useColors } from '@/lib/useColors';
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Eyebrow,
  Loading,
  Screen,
  StatPill,
  Title,
} from '@/components/ui';
import { useAuth } from '@/store/auth';
import { font, radius, space } from '@/theme';

export default function Home() {
  const c = useColors();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  // A sabipass://duel/CODE link lands here with the code pre-filled.
  const { code } = useLocalSearchParams<{ code?: string }>();

  const me = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: status === 'signedIn' });
  const matches = useQuery({
    queryKey: ['matches'],
    queryFn: api.myMatches,
    enabled: status === 'signedIn',
  });

  if (status === 'loading') {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (status === 'signedOut') return <Redirect href="/sign-in" />;

  const stats = me.data?.stats;
  const pending = (matches.data?.matches ?? []).filter(
    (m) => m.status !== 'settled' && m.answeredCount < m.totalQuestions,
  );
  const recent = (matches.data?.matches ?? []).filter((m) => m.status === 'settled');

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Eyebrow>WELCOME BACK</Eyebrow>
        <Title>{user?.username ?? 'Player'}</Title>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <StatPill label="WON" value={String(stats?.wins ?? 0)} />
          <StatPill label="LOST" value={String(stats?.losses ?? 0)} />
          <StatPill label="STREAK" value={String(stats?.streak ?? 0)} />
          <StatPill label="BEST" value={String(stats?.bestStreak ?? 0)} />
        </View>
      </Card>

      {matches.isError ? (
        <ErrorNote message="Could not load your matches. Pull to retry or check your connection." />
      ) : null}

      <View style={{ gap: space.md }}>
        <Button label="Quick duel" onPress={() => router.push('/subjects?mode=duel')} />
        <Button
          label="Practice"
          variant="secondary"
          onPress={() => router.push('/subjects?mode=solo')}
        />
        <JoinByCode initialCode={typeof code === 'string' ? code : ''} />
      </View>

      {pending.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ ...font.heading, color: c.text }}>Continue</Text>
          {pending.map((m) => (
            <Pressable
              key={m.matchId}
              onPress={() => router.push(`/play/${m.matchId}`)}
              accessibilityRole="button"
              style={{
                backgroundColor: c.surface,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: space.lg,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ gap: 2 }}>
                <Text style={{ ...font.heading, color: c.text }}>
                  {m.subject?.name ?? 'Mixed'}
                </Text>
                <Text style={{ ...font.label, color: c.textMuted }}>
                  {m.mode === 'solo' ? 'PRACTICE' : 'DUEL'} ·{' '}
                  {m.answeredCount}/{m.totalQuestions} ANSWERED
                </Text>
              </View>
              <Text style={{ ...font.heading, color: c.accent }}>Resume</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {recent.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ ...font.heading, color: c.text }}>Finished</Text>
          {recent.slice(0, 5).map((m) => (
            <Pressable
              key={m.matchId}
              onPress={() => router.push(`/result/${m.matchId}`)}
              accessibilityRole="button"
              style={{
                paddingVertical: space.md,
                paddingHorizontal: space.lg,
                borderRadius: radius.sm,
                backgroundColor: c.surfaceAlt,
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ ...font.body, fontSize: 14, color: c.text }}>
                {m.subject?.name ?? 'Mixed'}
              </Text>
              <Text style={{ ...font.label, color: c.textMuted }}>VIEW</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ flex: 1 }} />

      {__DEV__ ? (
        <Link href="/spike" asChild>
          <Pressable style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ ...font.label, color: c.textMuted }}>
              DEV · ANTI-CHEAT SPIKE
            </Text>
          </Pressable>
        </Link>
      ) : null}

      <Button
        label="Sign out"
        variant="ghost"
        onPress={() => useAuth.getState().signOut()}
      />
    </Screen>
  );
}

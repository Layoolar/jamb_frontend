import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { JoinByCode } from '@/components/JoinByCode';
import { api } from '@/lib/api';
import { useColors } from '@/lib/useColors';
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Eyebrow,
  Header,
  IconButton,
  Loading,
  Screen,
  StatPill,
  Title,
} from '@/components/ui';
import { useAuth } from '@/store/auth';
import type { MatchSummary } from '@/lib/types';
import { font, radius, space } from '@/theme';

export default function Home() {
  const c = useColors();
  const qc = useQueryClient();
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

  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['me'] }),
      qc.invalidateQueries({ queryKey: ['matches'] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  if (status === 'loading') {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (status === 'signedOut') return <Redirect href="/sign-in" />;

  const stats = me.data?.stats;
  const all = matches.data?.matches ?? [];

  /**
   * ONE pass with an exhaustive else, not three independent filters.
   *
   * Three filters is how a state goes missing: a duel where you had finished
   * but your opponent had not matched none of them, so the single most
   * interesting match you own — "they are playing your questions right now" —
   * rendered nowhere at all. Anything unrecognised now lands in `other`
   * instead of silently vanishing.
   */
  const yourTurn: MatchSummary[] = [];
  const waiting: MatchSummary[] = [];
  const finished: MatchSummary[] = [];
  const other: MatchSummary[] = [];

  for (const m of all) {
    if (m.status === 'settled') finished.push(m);
    else if (m.answeredCount < m.totalQuestions) yourTurn.push(m);
    else if (m.status === 'awaiting_opponent' || m.status === 'in_progress')
      waiting.push(m);
    else other.push(m);
  }

  // A brand-new account has nothing to show. Four zeros under "WELCOME BACK" is
  // the worst possible first impression, so explain the game instead and let
  // stats arrive once they mean something.
  const isNew = (stats?.duelsPlayed ?? 0) === 0 && all.length === 0;
  const pending = yourTurn;

  return (
    <Screen
      header={
        <Header
          title="SabiPass"
          right={<IconButton glyph="☰" label="Profile" onPress={() => router.push('/profile')} />}
        />
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={c.accent}
          colors={[c.accent]}
        />
      }
    >
      <View style={{ gap: space.xs }}>
        <Eyebrow>{isNew ? 'WELCOME' : 'WELCOME BACK'}</Eyebrow>
        <Title>{user?.username ?? 'Player'}</Title>
      </View>

      {isNew ? (
        <Card>
          <Text style={{ ...font.heading, color: c.text }}>How a challenge works</Text>
          <HowRow n="1" text="Ten questions. Fifteen seconds each." c={c} />
          <HowRow n="2" text="Send the code to a friend — same questions, their turn." c={c} />
          <HowRow n="3" text="Neither of you sees a score until you have both played." c={c} />
        </Card>
      ) : (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <StatPill label="WON" value={String(stats?.wins ?? 0)} />
            <StatPill label="LOST" value={String(stats?.losses ?? 0)} />
            <StatPill label="STREAK" value={String(stats?.streak ?? 0)} />
            <StatPill label="BEST" value={String(stats?.bestStreak ?? 0)} />
          </View>
        </Card>
      )}

      {matches.isError ? (
        <ErrorNote message="Could not load your matches. Pull down to try again." />
      ) : null}

      {/* An unfinished match sits ABOVE the primary action — it is probably why
          the app was reopened, and it used to be buried below the fold. */}
      {pending.length > 0 ? (
        <View style={{ gap: space.sm }}>
          {pending.map((m) => (
            <Pressable
              key={m.matchId}
              onPress={() => router.push(`/play/${m.matchId}`)}
              accessibilityRole="button"
              style={{
                backgroundColor: c.surface,
                borderColor: c.accent,
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
                  Resume {m.subject?.name ?? 'Mixed'}
                </Text>
                <Text style={{ ...font.label, color: c.textMuted }}>
                  {m.mode === 'solo' ? 'PRACTICE' : 'CHALLENGE'} ·{' '}
                  {m.answeredCount}/{m.totalQuestions} ANSWERED
                </Text>
              </View>
              <Text style={{ ...font.heading, color: c.accent }}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ gap: space.md }}>
        <Button label="Quick challenge" onPress={() => router.push('/subjects?mode=duel')} />
        <Button
          label="Practice"
          variant="secondary"
          onPress={() => router.push('/subjects?mode=solo')}
        />
        <JoinByCode initialCode={typeof code === 'string' ? code : ''} />
      </View>

      {waiting.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ ...font.heading, color: c.text }}>Waiting on them</Text>
          {waiting.map((m) => (
            <WaitingRow
              key={m.matchId}
              match={m}
              c={c}
              onPress={() => router.push(`/result/${m.matchId}`)}
            />
          ))}
        </View>
      ) : null}

      {finished.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ ...font.heading, color: c.text }}>Finished</Text>
          {finished.slice(0, 6).map((m) => (
            <MatchRow
              key={m.matchId}
              match={m}
              c={c}
              onPress={() => router.push(`/result/${m.matchId}`)}
            />
          ))}
        </View>
      ) : null}

      {/* Catch-all so an unexpected status is visible rather than lost. */}
      {other.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ ...font.heading, color: c.text }}>Other</Text>
          {other.map((m) => (
            <MatchRow
              key={m.matchId}
              match={m}
              c={c}
              onPress={() => router.push(`/result/${m.matchId}`)}
            />
          ))}
        </View>
      ) : null}

      <View style={{ flex: 1, minHeight: space.lg }} />

      {__DEV__ ? (
        <Link href="/spike" asChild>
          <Pressable style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ ...font.label, color: c.textMuted }}>
              DEV · ANTI-CHEAT SPIKE
            </Text>
          </Pressable>
        </Link>
      ) : null}
    </Screen>
  );
}

function HowRow({
  n,
  text,
  c,
}: {
  n: string;
  text: string;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <Text style={{ ...font.label, color: c.accent, paddingTop: 3 }}>{n}</Text>
      <Text style={{ ...font.body, color: c.textMuted, flex: 1, lineHeight: 22 }}>
        {text}
      </Text>
    </View>
  );
}

/**
 * A duel you have finished but that has no verdict yet.
 *
 * The two sub-states need different words and prompt different actions: nobody
 * has taken the challenge (share it, or take the bot), versus somebody is
 * answering right now (nothing to do but wait). Collapsing them into one
 * "waiting" row loses the only thing the player can act on.
 */
function WaitingRow({
  match,
  c,
  onPress,
}: {
  match: MatchSummary;
  c: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  const unclaimed = match.status === 'awaiting_opponent';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <View
        style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: c.sealed }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...font.body, color: c.text }}>
          {match.subject?.name ?? 'Mixed'}
        </Text>
        <Text style={{ ...font.label, color: c.textMuted }}>
          {unclaimed
            ? match.inviteCode
              ? `NOBODY HAS JOINED · CODE ${match.inviteCode}`
              : 'NOBODY HAS JOINED YET'
            : `${match.opponentName ?? 'THEY'} IS PLAYING · ${match.opponentAnsweredCount ?? 0}/${match.totalQuestions}`}
        </Text>
      </View>
      <Text style={{ ...font.label, color: c.accent }}>
        {unclaimed ? 'SHARE' : 'VIEW'}
      </Text>
    </Pressable>
  );
}

/** A finished match. Shows the outcome, not a generic "VIEW". */
function MatchRow({
  match,
  c,
  onPress,
}: {
  match: MatchSummary;
  c: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  const tint =
    match.outcome === 'won'
      ? c.correct
      : match.outcome === 'lost'
        ? c.wrong
        : match.outcome === 'draw'
          ? c.textMuted
          : c.sealed;

  const label =
    match.outcome === 'won'
      ? 'WON'
      : match.outcome === 'lost'
        ? 'LOST'
        : match.outcome === 'draw'
          ? 'DREW'
          : match.mode === 'solo'
            ? 'PRACTICE'
            : 'SEALED';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      {/* A severity stripe carries the outcome without relying on text alone. */}
      <View
        style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: tint }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...font.body, color: c.text }}>
          {match.subject?.name ?? 'Mixed'}
        </Text>
        <Text style={{ ...font.label, color: tint }}>
          {label}
          {match.opponentName ? ` · vs ${match.opponentName}` : ''}
        </Text>
      </View>
      {match.yourScore !== null ? (
        <Text
          style={{
            ...font.heading,
            color: c.text,
            fontVariant: ['tabular-nums'],
          }}
        >
          {match.yourScore}
          {match.opponentScore !== null ? (
            <Text style={{ ...font.label, color: c.textMuted }}>
              {'  '}
              {match.opponentScore}
            </Text>
          ) : null}
        </Text>
      ) : (
        <Text style={{ ...font.heading, color: c.textMuted }}>›</Text>
      )}
    </Pressable>
  );
}

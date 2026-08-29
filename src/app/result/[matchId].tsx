import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { InviteCard } from '@/components/InviteCard';
import { api } from '@/lib/api';
import { hasBeenAsked, registerForPush } from '@/lib/notifications';
import { useColors } from '@/lib/useColors';
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Eyebrow,
  Loading,
  Screen,
  Title,
} from '@/components/ui';
import { useAuth } from '@/store/auth';
import type { AnswerLine } from '@/lib/types';
import { font, radius, space } from '@/theme';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function Result() {
  const c = useColors();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const me = useAuth((s) => s.user);

  const qc = useQueryClient();

  const result = useQuery({
    queryKey: ['result', matchId],
    queryFn: () => api.matchResult(matchId),
    // The opponent may finish while this screen is open.
    refetchInterval: (q) =>
      q.state.data?.status === 'settled' ? false : 15_000,
  });

  const bot = useMutation({
    mutationFn: () => api.addBot(matchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['result', matchId] });
      qc.invalidateQueries({ queryKey: ['matches'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  /**
   * Ask for notification permission here — after a first duel is done, at the
   * moment "tell me when they reply" is obviously useful. Never at launch: a
   * cold prompt is the easiest way to earn a permanent no, and iOS gives one ask.
   */
  useEffect(() => {
    if (result.data?.mode !== 'duel') return;
    hasBeenAsked().then((asked) => {
      if (!asked) void registerForPush();
    });
  }, [result.data?.mode]);

  if (result.isLoading) {
    return (
      <Screen scroll={false}>
        <Loading label="Working out the result" />
      </Screen>
    );
  }

  if (result.isError || !result.data) {
    return (
      <Screen>
        <ErrorNote message="Could not load this result. Check your connection." />
        <Button label="Home" onPress={() => router.replace('/home')} />
      </Screen>
    );
  }

  const r = result.data;
  const solo = r.opponent === null;
  const won = r.winnerId !== null && r.winnerId === me?.id;

  const headline = solo
    ? 'Practice complete'
    : !r.revealed
      ? 'Answers in. Waiting.'
      : r.isDraw
        ? 'Dead heat'
        : won
          ? 'You won'
          : 'You lost';

  const correctCount = r.questions.filter((q) => q.yours?.isCorrect).length;

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Eyebrow>{(r.subject?.name ?? 'MIXED').toUpperCase()}</Eyebrow>
        <Title>{headline}</Title>
        {!solo && !r.revealed ? (
          <Body muted>
            Nobody sees a score until the duel is decided — that way neither of
            you can pick your moment. We&apos;ll notify you the second it lands.
          </Body>
        ) : null}
      </View>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ScoreSide
            name="You"
            score={r.you.score}
            ms={r.you.totalMs}
            forfeited={r.you.forfeited}
            highlight={won || solo}
          />
          {r.opponent ? (
            <>
              <Text style={{ ...font.label, color: c.textMuted, paddingHorizontal: space.md }}>
                VS
              </Text>
              <ScoreSide
                name={r.opponent.user.isBot ? 'Bot' : r.opponent.user.username}
                score={r.opponent.score}
                ms={r.opponent.totalMs}
                forfeited={r.opponent.forfeited}
                highlight={!won && !r.isDraw && r.opponent.finished}
              />
            </>
          ) : null}
        </View>
        <Text style={{ ...font.label, color: c.textMuted, textAlign: 'center' }}>
          {r.revealed
            ? `${correctCount} OF ${r.questions.length} CORRECT`
            : `${r.you.answeredCount} ANSWERED · SCORE SEALED`}
        </Text>
      </Card>

      {r.you.forfeited ? (
        <ErrorNote message="You forfeited this match by leaving the app during a question." />
      ) : null}

      {r.inviteCode ? (
        <InviteCard
          code={r.inviteCode}
          subject={r.subject?.name ?? 'mixed questions'}
          botBusy={bot.isPending}
          onPlayBot={() => bot.mutate()}
        />
      ) : null}

      {bot.isError ? (
        <ErrorNote message="Could not add a bot opponent. Try again in a moment." />
      ) : null}

      {r.questions.length > 0 ? (
        <View style={{ gap: space.md }}>
          <Text style={{ ...font.heading, color: c.text }}>Review</Text>
          {r.questions.map((q) => (
            <View
              key={q.qIndex}
              style={{
                backgroundColor: c.surface,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: space.lg,
                gap: space.sm,
              }}
            >
              <Text style={{ ...font.label, color: c.textMuted }}>
                Q{q.qIndex + 1}
              </Text>
              <Text style={{ ...font.body, color: c.text, lineHeight: 22 }}>{q.stem}</Text>

              <Text style={{ ...font.label, color: c.correct }}>
                ANSWER: {LETTERS[q.correctIndex]} — {q.options[q.correctIndex]}
              </Text>

              <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' }}>
                <Pick label="You" line={q.yours} correctIndex={q.correctIndex} />
                {r.opponent ? (
                  <Pick
                    label={r.opponent.user.isBot ? 'Bot' : r.opponent.user.username}
                    line={q.theirs}
                    correctIndex={q.correctIndex}
                  />
                ) : null}
              </View>

              {q.explanation ? <Body muted>{q.explanation}</Body> : null}
            </View>
          ))}
        </View>
      ) : (
        <Body muted>
          {solo
            ? 'The full review unlocks once you have answered every question.'
            : 'The full review — both sets of answers, with explanations — unlocks when the duel is decided.'}
        </Body>
      )}

      <View style={{ gap: space.md, marginTop: space.lg }}>
        <Button
          label="Play again"
          onPress={() =>
            router.replace(`/subjects?mode=${solo ? 'solo' : 'duel'}`)
          }
        />
        <Button label="Home" variant="ghost" onPress={() => router.replace('/home')} />
      </View>
    </Screen>
  );

  function ScoreSide({
    name,
    score,
    ms,
    forfeited,
    highlight,
  }: {
    name: string;
    score: number | null;
    ms: number | null;
    forfeited: boolean;
    highlight: boolean;
  }) {
    return (
      <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
        <Text style={{ ...font.label, color: c.textMuted }}>{name.toUpperCase()}</Text>
        <Text
          style={{
            ...font.display,
            color: score === null ? c.textMuted : highlight ? c.accent : c.text,
            fontVariant: ['tabular-nums'],
          }}
        >
          {score === null ? '—' : score}
        </Text>
        <Text style={{ ...font.label, color: c.textMuted }}>
          {forfeited
            ? 'FORFEIT'
            : ms === null
              ? 'HIDDEN'
              : `${(ms / 1000).toFixed(1)}S`}
        </Text>
      </View>
    );
  }

  function Pick({
    label,
    line,
    correctIndex,
  }: {
    label: string;
    line: AnswerLine | null;
    correctIndex: number;
  }) {
    if (!line) {
      return (
        <Text style={{ ...font.label, color: c.textMuted }}>
          {label.toUpperCase()}: —
        </Text>
      );
    }
    const ok = line.selectedIndex === correctIndex;
    return (
      <Text style={{ ...font.label, color: ok ? c.correct : c.wrong }}>
        {label.toUpperCase()}:{' '}
        {line.selectedIndex === null ? 'NO ANSWER' : LETTERS[line.selectedIndex]}
        {line.msTaken !== null ? ` · ${(line.msTaken / 1000).toFixed(1)}s` : ''}
      </Text>
    );
  }
}

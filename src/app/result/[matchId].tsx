import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
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

  const result = useQuery({
    queryKey: ['result', matchId],
    queryFn: () => api.matchResult(matchId),
    // The opponent may finish while this screen is open.
    refetchInterval: (q) =>
      q.state.data?.status === 'settled' ? false : 15_000,
  });

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
    : !r.opponent?.finished
      ? 'Waiting for your opponent'
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
        {!solo && !r.opponent?.finished ? (
          <Body muted>
            They have {r.opponent?.answeredCount ?? 0} of {r.questions.length} answered.
            We will let you know when they finish.
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
          {correctCount} OF {r.questions.length} CORRECT
        </Text>
      </Card>

      {r.you.forfeited ? (
        <ErrorNote message="You forfeited this match by leaving the app during a question." />
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
          The full review unlocks once you have answered every question.
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
    score: number;
    ms: number;
    forfeited: boolean;
    highlight: boolean;
  }) {
    return (
      <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
        <Text style={{ ...font.label, color: c.textMuted }}>{name.toUpperCase()}</Text>
        <Text
          style={{
            ...font.display,
            color: highlight ? c.accent : c.text,
            fontVariant: ['tabular-nums'],
          }}
        >
          {score}
        </Text>
        <Text style={{ ...font.label, color: c.textMuted }}>
          {forfeited ? 'FORFEIT' : `${(ms / 1000).toFixed(1)}S`}
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

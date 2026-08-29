/**
 * The question screen. This is the product (PLAN §7).
 *
 * State machine:
 *   loading  → serving the next question
 *   question → answerable, timer running
 *   revealed → correct answer shown, explanation visible
 *   transition → ~400ms slide while the NEXT serve request is already in flight
 *   done     → hand off to the result screen
 *
 * Two things worth understanding before editing:
 *
 * 1. The next question is requested at the START of the transition animation,
 *    not after it. A 3G round-trip is 300–800ms; without overlapping it with the
 *    animation the game feels broken between questions.
 *
 * 2. Timer expiry submits `selectedIndex: null` rather than doing nothing. The
 *    server would score it zero anyway, but submitting explicitly keeps the
 *    client and server on the same question index.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BackHandler, Pressable, Text, View } from 'react-native';
import { OptionButton, type OptionState } from '@/components/OptionButton';
import { TimerBar } from '@/components/TimerBar';
import { Body, Button, ErrorNote, Loading, Screen } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useColors } from '@/lib/useColors';
import type { AnswerResult, IntegrityFlag, ServedQuestion } from '@/lib/types';
import { font, radius, space } from '@/theme';

const REVEAL_MS = 1400;
const TRANSITION_MS = 400;

type Phase = 'loading' | 'question' | 'revealed' | 'transition' | 'done';

export default function Play() {
  const c = useColors();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const qc = useQueryClient();

  const [phase, setPhase] = useState<Phase>('loading');
  const [question, setQuestion] = useState<ServedQuestion | null>(null);
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  /**
   * Anti-cheat signals accumulate here between answers and ship with the next
   * submission. Populated in Phase 5; the plumbing exists now so the server
   * contract is exercised end to end.
   */
  const flags = useRef<IntegrityFlag[]>([]);
  const submitting = useRef(false);

  const finish = useCallback(() => {
    setPhase('done');
    qc.invalidateQueries({ queryKey: ['matches'] });
    qc.invalidateQueries({ queryKey: ['me'] });
    router.replace(`/result/${matchId}`);
  }, [matchId, qc]);

  const serve = useCallback(async () => {
    try {
      const q = await api.serveQuestion(matchId);
      setQuestion(q);
      setChosen(null);
      setAnswer(null);
      setReported(false);
      setPhase('question');
    } catch (e) {
      if (e instanceof ApiError) {
        // 409 means this player has answered everything, or the match ended.
        if (e.status === 409) {
          finish();
          return;
        }
        setError(e.message);
      } else {
        setError('Lost connection. Check your network and try again.');
      }
    }
  }, [matchId, finish]);

  useEffect(() => {
    serve();
  }, [serve]);

  // No back-out mid-question: leaving is a strike, not an escape hatch.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const submit = useCallback(
    async (selectedIndex: number | null) => {
      if (!question || submitting.current) return;
      submitting.current = true;

      setChosen(selectedIndex);
      setPhase('revealed');

      if (selectedIndex !== null) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      try {
        const r = await api.submitAnswer(
          matchId,
          question.questionId,
          selectedIndex,
          flags.current,
        );
        flags.current = [];
        setAnswer(r);
        setScore(r.runningScore);

        Haptics.notificationAsync(
          r.isCorrect
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});

        const done = r.isFinalQuestion || r.forfeited;

        setTimeout(() => {
          submitting.current = false;
          if (done) {
            finish();
            return;
          }
          // Fire the next serve NOW, so the round-trip hides behind the animation.
          setPhase('transition');
          void serve();
        }, REVEAL_MS);
      } catch (e) {
        submitting.current = false;
        setError(
          e instanceof ApiError
            ? e.message
            : 'Could not submit that answer. Check your connection.',
        );
      }
    },
    [matchId, question, serve, finish],
  );

  const report = useCallback(async () => {
    if (!question || reported) return;
    setReported(true);
    try {
      await api.reportQuestion(question.questionId, 'Reported from the reveal screen');
    } catch {
      // A failed report is not worth interrupting a match for.
    }
  }, [question, reported]);

  if (error) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
          <ErrorNote message={error} />
          <Button
            label="Try again"
            onPress={() => {
              setError(null);
              setPhase('loading');
              void serve();
            }}
          />
          <Button label="Leave match" variant="ghost" onPress={() => router.replace('/home')} />
        </View>
      </Screen>
    );
  }

  if (!question || phase === 'loading' || phase === 'done') {
    return (
      <Screen scroll={false}>
        <Loading label="Getting your question" />
      </Screen>
    );
  }

  const revealed = phase === 'revealed' && answer !== null;

  const stateFor = (i: number): OptionState => {
    if (phase === 'question') return 'idle';
    if (!answer) return i === chosen ? 'pending' : 'dimmed';
    if (i === answer.correctIndex) return 'correct';
    if (i === chosen) return 'wrong';
    return 'dimmed';
  };

  return (
    <Screen scroll={false}>
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ ...font.label, color: c.textMuted }}>
            {question.subject.toUpperCase()}
            {question.year ? ` · ${question.year}` : ''}
          </Text>
          <Text style={{ ...font.label, color: c.textMuted }}>
            {question.qIndex + 1} / {question.totalQuestions} · {score} PTS
          </Text>
        </View>

        <TimerBar
          deadlineAt={question.deadlineAt}
          serverNow={question.serverNow}
          paused={phase !== 'question'}
          onExpire={() => submit(null)}
        />
      </View>

      <View style={{ paddingVertical: space.xl, minHeight: 120, justifyContent: 'center' }}>
        <Text
          selectable={false}
          style={{ ...font.title, color: c.text, lineHeight: 30 }}
        >
          {question.stem}
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        {question.options.map((opt, i) => (
          <OptionButton
            key={i}
            index={i}
            label={opt}
            state={stateFor(i)}
            onPress={() => submit(i)}
          />
        ))}
      </View>

      <View style={{ flex: 1, justifyContent: 'flex-end', gap: space.sm }}>
        {revealed && answer ? (
          <View
            style={{
              backgroundColor: c.surface,
              borderRadius: radius.md,
              borderLeftWidth: 3,
              borderLeftColor: answer.isCorrect ? c.correct : c.wrong,
              padding: space.lg,
              gap: space.xs,
            }}
          >
            <Text
              style={{
                ...font.label,
                color: answer.isCorrect ? c.correct : c.wrong,
              }}
            >
              {answer.wasLate
                ? 'TIME UP · 0 PTS'
                : answer.isCorrect
                  ? `CORRECT · +${answer.points} PTS`
                  : 'WRONG · 0 PTS'}
            </Text>
            {answer.explanation ? (
              <Body muted>{answer.explanation}</Body>
            ) : null}
            <Pressable
              onPress={report}
              accessibilityRole="button"
              style={{ minHeight: 36, justifyContent: 'center' }}
            >
              <Text style={{ ...font.label, color: reported ? c.textMuted : c.accent }}>
                {reported ? 'REPORTED — THANK YOU' : 'REPORT THIS QUESTION'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

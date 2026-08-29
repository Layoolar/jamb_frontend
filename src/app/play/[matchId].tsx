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
import {
  armCaptureProtection,
  isSplitScreen,
  onScreenshot,
  releaseCaptureProtection,
  watchAppAway,
} from '@/lib/anticheat';
import { useColors } from '@/lib/useColors';
import type { AnswerResult, IntegrityFlag, ServedQuestion } from '@/lib/types';
import { font, radius, space } from '@/theme';

const REVEAL_MS = 1400;
const CAPTURE_TAG = 'question';
/** Matches the server's threshold in services/scoring.ts. */
const STRIKE_THRESHOLD_MS = 2000;

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
   * Anti-cheat signals accumulate here and ship with the next submission, so a
   * flag raised during question N is scored against question N.
   */
  const flags = useRef<IntegrityFlag[]>([]);
  const submitting = useRef(false);
  const [splitScreen, setSplitScreen] = useState(isSplitScreen());

  /**
   * Capture protection is armed for the LIFETIME OF THIS SCREEN ONLY.
   *
   * The result screen must stay screenshottable — a score posted to a WhatsApp
   * group is the app's cheapest acquisition channel (PLAN §4), so blocking
   * capture everywhere would cost more than it protects.
   */
  useEffect(() => {
    void armCaptureProtection(CAPTURE_TAG);
    return () => {
      void releaseCaptureProtection(CAPTURE_TAG);
    };
  }, []);

  /**
   * Leaving the app during a live question is the "swipe to ChatGPT" path.
   * The flag can only ever hurt the reporter, so a hostile client gains nothing
   * by suppressing or faking it — the server decides what it costs.
   */
  useEffect(
    () =>
      watchAppAway((e) => {
        if (e.isStrike) {
          flags.current.push({ kind: 'app_away', msAway: e.msAway });
        }
      }, STRIKE_THRESHOLD_MS),
    [],
  );

  /**
   * On Android a screenshot should be impossible here (FLAG_SECURE). If the
   * listener fires anyway, blocking has failed and we want to know. On iOS it is
   * the fallback signal.
   */
  useEffect(() => onScreenshot(() => flags.current.push({ kind: 'screenshot' })), []);

  // Split-screen would let a second app sit beside the question.
  useEffect(() => {
    const id = setInterval(() => setSplitScreen(isSplitScreen()), 1000);
    return () => clearInterval(id);
  }, []);

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
        if (r.runningScore !== null) setScore(r.runningScore);

        // In a duel the haptic must NOT betray the answer — a success buzz is
        // just as much of a tell as showing the correct option.
        if (r.revealed) {
          Haptics.notificationAsync(
            r.isCorrect
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning,
          ).catch(() => {});
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
        }

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

  if (splitScreen) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
          <ErrorNote message="Split-screen is not allowed during a question. Return the app to full screen to carry on — your timer is still running." />
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

  // The post-answer card shows for every mode; what it CONTAINS depends on
  // answer.revealed (practice explains, a duel only acknowledges).
  const showResult = phase === 'revealed' && answer !== null;

  const stateFor = (i: number): OptionState => {
    if (phase === 'question') return 'idle';
    // Duel: show only which option was locked in, never whether it was right.
    if (!answer || !answer.revealed) return i === chosen ? 'pending' : 'dimmed';
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
            {question.qIndex + 1} / {question.totalQuestions}
            {answer?.revealed || score > 0 ? ` · ${score} PTS` : ''}
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
        {showResult && answer ? (
          answer.revealed ? (
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
              {answer.explanation ? <Body muted>{answer.explanation}</Body> : null}
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
          ) : (
            /* Duel: acknowledge the answer without leaking anything about it. */
            <View
              style={{
                backgroundColor: c.surface,
                borderRadius: radius.md,
                borderLeftWidth: 3,
                borderLeftColor: c.border,
                padding: space.lg,
                gap: space.xs,
              }}
            >
              <Text style={{ ...font.label, color: c.textMuted }}>
                {answer.wasLate ? 'TIME UP' : 'ANSWER LOCKED IN'}
              </Text>
              <Body muted>
                {answer.isFinalQuestion
                  ? 'That was the last one. You will see how you did when your opponent finishes.'
                  : 'Results are revealed when the duel is decided.'}
              </Body>
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
          )
        ) : null}
      </View>
    </Screen>
  );
}

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
  const [retrying, setRetrying] = useState(false);
  const [strikeNotice, setStrikeNotice] = useState(false);
  const strikesSeen = useRef(0);

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

        // A strike costs you the question. Warn on the FIRST one — the lobby
        // states the rule, but nobody reads a rules screen, and being ejected
        // with no warning reads as a bug rather than a fair cop (PLAN §4).
        if (r.strikes > strikesSeen.current && !r.forfeited) {
          strikesSeen.current = r.strikes;
          setStrikeNotice(true);
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

        // A late answer is final — the server already scored it zero, so
        // retrying is pointless and re-showing the question would mislead.
        if (e instanceof ApiError && e.status !== 0 && e.status < 500) {
          setError(e.message);
          return;
        }

        /**
         * Network failure. Do NOT take over the screen: the server-side
         * deadline is still running, so a full-screen error hides the question
         * during the seconds the player still has. Keep everything visible,
         * show a banner, and retry automatically — waiting for a human to tap
         * "try again" is far too slow against a 15-second clock.
         */
        setRetrying(true);
        for (let attempt = 0; attempt < 3; attempt++) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          try {
            const r = await api.submitAnswer(
              matchId,
              question.questionId,
              selectedIndex,
              flags.current,
            );
            flags.current = [];
            setAnswer(r);
            setRetrying(false);
            if (r.runningScore !== null) setScore(r.runningScore);
            setTimeout(() => {
              submitting.current = false;
              if (r.isFinalQuestion || r.forfeited) finish();
              else {
                setPhase('transition');
                void serve();
              }
            }, REVEAL_MS);
            return;
          } catch {
            // keep trying
          }
        }
        setRetrying(false);
        setError('Still no connection. Your answer was not recorded.');
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

  /**
   * Strike one. Blocking and deliberate: the whole point is that the second
   * strike must never be a surprise. Shown after the answer is safely recorded,
   * so acknowledging it costs the player nothing.
   */
  if (strikeNotice) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
          <Text style={{ ...font.label, color: c.wrong }}>STRIKE ONE</Text>
          <Text style={{ ...font.title, color: c.text, lineHeight: 30 }}>
            You left the app during that question
          </Text>
          <Body muted>
            It scored zero. Leave once more and you forfeit the match — the
            clock keeps running on our servers whether the app is open or not.
          </Body>
          <View style={{ flex: 1 }} />
          <Button label="Got it — keep playing" onPress={() => setStrikeNotice(false)} />
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

        {/* Inline, never a screen takeover — the clock is still running and the
            player needs to keep seeing the question. */}
        {retrying ? (
          <View
            style={{
              backgroundColor: c.surfaceAlt,
              borderRadius: radius.sm,
              paddingVertical: space.sm,
              paddingHorizontal: space.md,
            }}
          >
            <Text style={{ ...font.label, color: c.textMuted }}>
              CONNECTION DROPPED — RESENDING YOUR ANSWER
            </Text>
          </View>
        ) : null}
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
                  ? 'That was the last one. You will see how you did when your study partner finishes.'
                  : 'Results are revealed when the challenge is decided.'}
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

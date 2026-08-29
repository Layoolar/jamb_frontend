import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import { makeClock, remainingMs, type ServerClock } from '@/lib/clock';
import { useColors } from '@/lib/useColors';
import { font, QUESTION_SECONDS, radius, space } from '@/theme';

/**
 * A shrinking bar rather than a ticking number.
 *
 * A counting-down numeral pulls the eye off the question and reads as more
 * hostile than it is; a bar is legible peripherally. It turns amber then red as
 * time runs out so urgency is carried by more than colour alone (the bar's
 * length is the primary signal, which also keeps it readable for colour-blind
 * players).
 *
 * Driven by a plain interval rather than a Reanimated timing animation, because
 * the source of truth is the SERVER deadline, not an animation duration — an
 * animation would drift away from it after a slow frame or a backgrounded app.
 */
export function TimerBar({
  deadlineAt,
  serverNow,
  paused = false,
  onExpire,
}: {
  deadlineAt: string;
  serverNow: string;
  paused?: boolean;
  onExpire?: () => void;
}) {
  const c = useColors();
  const [clock, setClock] = useState<ServerClock>(() => makeClock(deadlineAt, serverNow));
  const [left, setLeft] = useState(() => remainingMs(clock));
  const fired = useRef(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // A new question means a new deadline and a fresh offset measurement.
  useEffect(() => {
    const next = makeClock(deadlineAt, serverNow);
    setClock(next);
    setLeft(remainingMs(next));
    fired.current = false;
  }, [deadlineAt, serverNow]);

  useEffect(() => {
    if (paused) return;

    // ~20fps is smooth enough for a bar and far cheaper than 60 on a low-end
    // Android, which is the median device in this market.
    const id = setInterval(() => {
      const ms = remainingMs(clock);
      setLeft(ms);
      if (ms <= 0 && !fired.current) {
        fired.current = true;
        onExpire?.();
      }
    }, 50);

    return () => clearInterval(id);
  }, [clock, paused, onExpire]);

  const total = QUESTION_SECONDS * 1000;
  const fraction = Math.max(0, Math.min(1, left / total));
  const seconds = Math.ceil(left / 1000);

  const tint = fraction > 0.5 ? c.accent : fraction > 0.2 ? c.warn : c.wrong;

  return (
    <View style={{ gap: space.xs }}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${seconds} seconds left`}
        style={{
          height: 8,
          borderRadius: radius.pill,
          backgroundColor: c.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${fraction * 100}%`,
            height: '100%',
            backgroundColor: tint,
            borderRadius: radius.pill,
          }}
        />
      </View>

      {/* A numeral is redundant most of the time but reassuring at the end, and
          it is the only cue available when reduce-motion is on. */}
      {reduceMotion || fraction <= 0.34 ? (
        <Text
          style={{
            ...font.label,
            color: tint,
            textAlign: 'right',
            fontVariant: ['tabular-nums'],
          }}
        >
          {seconds}s
        </Text>
      ) : (
        <View style={{ height: 16 }} />
      )}
    </View>
  );
}

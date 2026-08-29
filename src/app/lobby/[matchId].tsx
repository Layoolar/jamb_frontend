/**
 * Pre-match lobby.
 *
 * Exists mainly to state the strike rule BEFORE it can bite. A silent forfeit
 * reads as a bug and loses the user (PLAN §4), so leaving the app costing you
 * the match has to be something you were told, not something you discover.
 */

import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, Eyebrow, Header, Screen, Title } from '@/components/ui';
import { useColors } from '@/lib/useColors';
import { font, QUESTION_SECONDS, radius, space } from '@/theme';

/**
 * Scannable rows, not paragraphs. Nobody reads a wall of policy text before a
 * timed game — the point is that the strike rule registers, and it only
 * registers if the whole list can be taken in at a glance.
 */
const RULES: { key: string; text: string; stern?: boolean }[] = [
  { key: `${QUESTION_SECONDS}s`, text: 'per question. The clock runs on our server.' },
  { key: 'FAST', text: 'Quicker correct answers score more.' },
  { key: '0', text: 'Wrong answers score zero. No negative marking.' },
  { key: 'NO', text: 'Screenshots are blocked during a question.' },
  {
    key: '2×',
    text: 'Leave the app mid-question and it scores zero. Twice and you forfeit.',
    stern: true,
  },
];

export default function Lobby() {
  const c = useColors();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      router.replace(`/play/${matchId}`);
      return;
    }
    const t = setTimeout(() => setCountdown((n) => (n === null ? null : n - 1)), 800);
    return () => clearTimeout(t);
  }, [countdown, matchId]);

  if (countdown !== null) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
          {/*
            The countdown fills an answer bubble per tick. It is the same shape
            as the mark and the subject picker, so the anticipation is carried by
            the app's own vocabulary rather than by a generic number.
          */}
          <View style={{ flexDirection: 'row', gap: space.md }}>
            {[3, 2, 1].map((n) => {
              const filled = countdown <= n;
              return (
                <View
                  key={n}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: filled ? c.accent : c.border,
                    backgroundColor: filled ? c.accent : 'transparent',
                  }}
                />
              );
            })}
          </View>

          <Text
            style={{
              fontSize: 104,
              fontWeight: '700',
              color: countdown === 0 ? c.correct : c.accent,
              fontVariant: ['tabular-nums'],
              lineHeight: 116,
            }}
          >
            {countdown === 0 ? 'GO' : countdown}
          </Text>

          <Text style={{ ...font.label, color: c.textMuted }}>
            {QUESTION_SECONDS} SECONDS PER QUESTION
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={<Header title="House rules" onHome={() => router.replace('/home')} />}>
      <View style={{ gap: space.xs, marginTop: space.lg }}>
        <Eyebrow>BEFORE YOU START</Eyebrow>
        <Title>House rules</Title>
      </View>

      <Card>
        <View style={{ gap: space.md }}>
          {RULES.map((rule) => (
            <View
              key={rule.key}
              style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}
            >
              <View
                style={{
                  minWidth: 42,
                  paddingVertical: 3,
                  borderRadius: radius.sm,
                  backgroundColor: rule.stern ? c.wrong : c.surfaceAlt,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    ...font.label,
                    color: rule.stern ? c.onWrong : c.textMuted,
                  }}
                >
                  {rule.key}
                </Text>
              </View>
              <Text
                style={{
                  ...font.body,
                  fontSize: 15,
                  color: rule.stern ? c.text : c.textMuted,
                  flex: 1,
                  lineHeight: 21,
                }}
              >
                {rule.text}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={{ flex: 1 }} />

      <Button label="I'm ready" onPress={() => setCountdown(3)} />
    </Screen>
  );
}

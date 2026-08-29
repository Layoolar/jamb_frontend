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
import { Body, Button, Card, Eyebrow, Screen, Title } from '@/components/ui';
import { useColors } from '@/lib/useColors';
import { font, QUESTION_SECONDS, space } from '@/theme';

const RULES = [
  `${QUESTION_SECONDS} seconds per question. The clock runs on our server, so closing the app does not pause it.`,
  'Faster correct answers score more. Wrong answers score zero — there is no negative marking.',
  'Screenshots are blocked while a question is on screen.',
  'Leaving the app during a question scores that question zero. Twice and you forfeit the match.',
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              fontSize: 96,
              fontWeight: '700',
              color: c.accent,
              fontVariant: ['tabular-nums'],
            }}
          >
            {countdown === 0 ? 'GO' : countdown}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: space.xs, marginTop: space.lg }}>
        <Eyebrow>BEFORE YOU START</Eyebrow>
        <Title>House rules</Title>
      </View>

      <Card>
        <View style={{ gap: space.lg }}>
          {RULES.map((rule, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: space.md }}>
              <Text style={{ ...font.label, color: c.accent, paddingTop: 3 }}>
                {String(i + 1).padStart(2, '0')}
              </Text>
              <View style={{ flex: 1 }}>
                <Body muted>{rule}</Body>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <View style={{ flex: 1 }} />

      <Button label="I'm ready" onPress={() => setCountdown(3)} />
      <Button label="Not now" variant="ghost" onPress={() => router.replace('/home')} />
    </Screen>
  );
}

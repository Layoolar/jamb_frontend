import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Share, Text, View } from 'react-native';
import { Body, Button } from '@/components/ui';
import { useColors } from '@/lib/useColors';
import { font, radius, space } from '@/theme';

/**
 * Shown on the result screen while a duel is still open.
 *
 * This is the acquisition channel: a code pasted into a WhatsApp study group is
 * cheaper than any advertising, which is why the share text leads with the
 * score the challenger has to beat rather than with the app's name.
 */
export function InviteCard({
  code,
  scoreToBeat,
  subject,
  onPlayBot,
  botBusy,
}: {
  code: string;
  scoreToBeat: number;
  subject: string;
  onPlayBot: () => void;
  botBusy: boolean;
}) {
  const c = useColors();
  const [copied, setCopied] = useState(false);

  const message =
    `I scored ${scoreToBeat} on ${subject} in SabiPass. Beat that.\n\n` +
    `Code: ${code}\n` +
    `sabipass://duel/${code}`;

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderColor: c.accent,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: space.lg,
        gap: space.md,
      }}
    >
      <Text style={{ ...font.label, color: c.accent }}>SHARE THIS DUEL</Text>
      <Body muted>
        Send the code to a friend. They answer the same ten questions and we
        compare scores.
      </Body>

      <View
        style={{
          backgroundColor: c.surfaceAlt,
          borderRadius: radius.sm,
          paddingVertical: space.md,
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            ...font.display,
            color: c.text,
            letterSpacing: 4,
            fontVariant: ['tabular-nums'],
          }}
        >
          {code}
        </Text>
      </View>

      <Button label="Share" onPress={() => Share.share({ message })} />
      <Button
        label={copied ? 'Copied' : 'Copy code'}
        variant="secondary"
        onPress={copy}
      />
      <Button
        label="Play a bot instead"
        variant="ghost"
        onPress={onPlayBot}
        busy={botBusy}
      />
    </View>
  );
}

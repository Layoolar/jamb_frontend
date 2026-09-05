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
 * cheaper than any advertising.
 *
 * The share text cannot name a score to beat, because the challenger does not
 * know their own score yet — neither player sees anything until the duel is
 * decided. That turns out to be the better hook anyway: "I've taken my shot"
 * invites a reply, where "I scored 1840" invites a shrug.
 */
export function InviteCard({
  code,
  subject,
  onPlayBot,
  botBusy,
}: {
  code: string;
  subject: string;
  onPlayBot: () => void;
  botBusy: boolean;
}) {
  const c = useColors();
  const [copied, setCopied] = useState(false);

  const message =
    `I've taken my shot at ${subject} on SabiPass. Same ten questions, ` +
    `15 seconds each. Neither of us sees a score until we've both played.\n\n` +
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
      <Text style={{ ...font.label, color: c.accent }}>SHARE THIS CHALLENGE</Text>
      <Body muted>
        Send the code to a friend. They answer the same ten questions, then you
        both find out together.
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

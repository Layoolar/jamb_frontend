import { Pressable, Text, View } from 'react-native';
import { useColors } from '@/lib/useColors';
import { font, radius, space, TAP_TARGET } from '@/theme';

export type OptionState =
  /** Answerable. */
  | 'idle'
  /** Chosen, waiting on the server. */
  | 'pending'
  /** Revealed: this was the right answer. */
  | 'correct'
  /** Revealed: the player picked this and it was wrong. */
  | 'wrong'
  /** Revealed: not chosen, not the answer. */
  | 'dimmed';

const LETTERS = ['A', 'B', 'C', 'D'];

export function OptionButton({
  index,
  label,
  state,
  onPress,
}: {
  index: number;
  label: string;
  state: OptionState;
  onPress: () => void;
}) {
  const c = useColors();

  const tint =
    state === 'correct' ? c.correct : state === 'wrong' ? c.wrong : c.border;

  const bg =
    state === 'correct'
      ? c.correct
      : state === 'wrong'
        ? c.wrong
        : state === 'pending'
          ? c.surfaceAlt
          : c.surface;

  const onTint = state === 'correct' || state === 'wrong';
  const fg = onTint ? '#0F0D0A' : state === 'dimmed' ? c.textMuted : c.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={state !== 'idle'}
      accessibilityRole="button"
      accessibilityLabel={`Option ${LETTERS[index]}: ${label}`}
      style={({ pressed }) => ({
        minHeight: TAP_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: tint,
        backgroundColor: bg,
        opacity: state === 'dimmed' ? 0.55 : pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: onTint ? '#0F0D0A' : c.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ ...font.label, color: fg }}>{LETTERS[index]}</Text>
      </View>

      {/* selectable={false} kills copy/paste of the question text — one of the
          cheap anti-cheat wins (PLAN §4). */}
      <Text selectable={false} style={{ ...font.option, color: fg, flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

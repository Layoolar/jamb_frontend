import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  type ScrollViewProps,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/lib/useColors';
import { font, radius, space, TAP_TARGET } from '@/theme';

export function Screen({
  children,
  scroll = true,
  header,
  refreshControl,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Pass a <RefreshControl> to make the screen pull-to-refresh. */
  refreshControl?: ScrollViewProps['refreshControl'];
  /**
   * Rendered OUTSIDE the ScrollView so it stays pinned. A way out that scrolls
   * off the top is not a way out — you should never have to scroll to leave a
   * screen.
   */
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const inner = (
    <View
      style={[
        { padding: space.xl, paddingTop: header ? space.md : space.xl, gap: space.lg, flexGrow: 1 },
        style,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

/**
 * Fixed top bar. `onBack` and `onHome` are separate on purpose: on a result
 * screen "back" would return you into the match you just finished, so those
 * screens want an explicit route home instead of browser-style history.
 */
export function Header({
  title,
  onBack,
  onHome,
  right,
}: {
  title?: string;
  onBack?: () => void;
  onHome?: () => void;
  right?: ReactNode;
}) {
  const c = useColors();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        backgroundColor: c.bg,
      }}
    >
      {onBack ? (
        <IconButton label="Back" glyph="‹" onPress={onBack} />
      ) : onHome ? (
        <IconButton label="Home" glyph="⌂" onPress={onHome} />
      ) : (
        <View style={{ width: 44 }} />
      )}

      <Text
        numberOfLines={1}
        style={{ ...font.heading, color: c.text, flex: 1 }}
      >
        {title ?? ''}
      </Text>

      {right ?? <View style={{ width: 44 }} />}
    </View>
  );
}

export function IconButton({
  glyph,
  label,
  onPress,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.sm,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: 24, lineHeight: 28, color: c.text }}>{glyph}</Text>
    </Pressable>
  );
}

/**
 * The SabiPass mark, drawn in views rather than shipped as an image.
 *
 * Four answer bubbles, one filled — the same shape as the app icon. Drawing it
 * means it inherits the theme automatically and costs no asset, and it stays
 * crisp at any size.
 */
export function BrandMark({ size = 44 }: { size?: number }) {
  const c = useColors();
  const gap = size * 0.12;
  const d = (size - gap) / 2;
  const ring = Math.max(2, d * 0.18);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="SabiPass"
      style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap }}
    >
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: d,
            height: d,
            borderRadius: d / 2,
            borderWidth: i === 3 ? 0 : ring,
            borderColor: c.accent,
            backgroundColor: i === 3 ? c.accent : 'transparent',
          }}
        />
      ))}
    </View>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ ...font.label, color: c.accent }}>{children}</Text>;
}

export function Title({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ ...font.display, color: c.text }}>{children}</Text>;
}

export function Body({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  const c = useColors();
  return (
    <Text style={{ ...font.body, color: muted ? c.textMuted : c.text, lineHeight: 23 }}>
      {children}
    </Text>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: space.lg,
          gap: space.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
}) {
  const c = useColors();
  const off = disabled || busy;

  const bg =
    variant === 'primary' ? c.accent : variant === 'secondary' ? c.surfaceAlt : 'transparent';
  const fg = variant === 'primary' ? c.onAccent : c.text;
  const border = variant === 'ghost' ? c.border : bg;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      style={({ pressed }) => ({
        minHeight: TAP_TARGET,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: off ? 0.45 : pressed ? 0.82 : 1,
        paddingHorizontal: space.lg,
      })}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ ...font.heading, color: fg }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function ErrorNote({ message }: { message: string }) {
  const c = useColors();
  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: c.wrong,
        backgroundColor: c.surface,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.sm,
      }}
    >
      <Text style={{ ...font.body, fontSize: 14, color: c.text }}>{message}</Text>
    </View>
  );
}

export function StatPill({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', gap: 2, minWidth: 64 }}>
      <Text
        style={{
          ...font.title,
          color: c.text,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text style={{ ...font.label, color: c.textMuted }}>{label}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <ActivityIndicator color={c.accent} size="large" />
      {label ? <Text style={{ ...font.body, color: c.textMuted }}>{label}</Text> : null}
    </View>
  );
}


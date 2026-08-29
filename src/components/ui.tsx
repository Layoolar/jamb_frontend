import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const inner = (
    <View style={[{ padding: space.xl, gap: space.lg, flexGrow: 1 }, style]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
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


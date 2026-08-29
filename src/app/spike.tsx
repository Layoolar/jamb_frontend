/**
 * Phase 1 — anti-cheat spike (BUILD.md Phase 1).
 *
 * Run this on a physical Android device and a physical iPhone. It arms real
 * capture protection and reports what it can detect automatically; the rest you
 * confirm by hand. Tap "Share results" at the end and send the output back.
 *
 * This is a GO / NO-GO gate. Four checks decide it:
 *   Android screenshot, Android Gemini read, Android Circle to Search, iOS screenshot.
 *
 * Deleted at the start of Phase 3, when this route becomes the real Home screen.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Header } from '@/components/ui';
import * as Device from 'expo-device';
import {
  armCaptureProtection,
  isSplitScreen,
  onScreenshot,
  releaseCaptureProtection,
  requestScreenshotDetectionPermission,
  watchAppAway,
} from '@/lib/anticheat';
import { useColors } from '@/lib/useColors';
import { font, radius, space, TAP_TARGET, type Colors } from '@/theme';

const TAG = 'spike';

type Verdict = 'unknown' | 'pass' | 'fail';

type Check = {
  id: string;
  platform: 'android' | 'ios' | 'both';
  critical: boolean;
  title: string;
  how: string;
};

const CHECKS: Check[] = [
  {
    id: 'screenshot-blocked',
    platform: 'both',
    critical: true,
    title: 'Screenshot is blocked',
    how: 'With protection ARMED, take a screenshot. Open your gallery. Pass = the image is black or no image was saved.',
  },
  {
    id: 'recording-blocked',
    platform: 'both',
    critical: false,
    title: 'Screen recording is blocked',
    how: 'Start a screen recording, wait 5s, stop it, play it back. Pass = this screen is black in the recording.',
  },
  {
    id: 'gemini-blocked',
    platform: 'android',
    critical: true,
    title: 'Gemini cannot read the screen',
    how: 'Hold the power button (or say "Hey Google") to open Gemini, then ask "what is on my screen?". Pass = it cannot see this screen.',
  },
  {
    id: 'circle-search-blocked',
    platform: 'android',
    critical: true,
    title: 'Circle to Search cannot read the screen',
    how: 'Long-press the home button / navigation handle to trigger Circle to Search. Pass = it shows nothing or refuses to capture.',
  },
  {
    id: 'ios-screenshot-blocked',
    platform: 'ios',
    critical: true,
    title: 'iOS screenshot is actually blocked',
    how: 'Expo claims iOS 13+ blocking, but it is a native trick rather than a public API. Take a screenshot and check Photos. Pass = black or nothing saved.',
  },
  {
    id: 'disarm-works',
    platform: 'both',
    critical: false,
    title: 'Disarming restores capture',
    how: 'Tap DISARM, then take a screenshot. Pass = the screenshot works normally. This proves per-screen toggling works, needed for the shareable result screen.',
  },
];

export default function AntiCheatSpike() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const [armed, setArmed] = useState(false);
  const [armError, setArmError] = useState<string | null>(null);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [shots, setShots] = useState(0);
  const [away, setAway] = useState<{ msAway: number; isStrike: boolean }[]>([]);
  const [split, setSplit] = useState(isSplitScreen());
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});

  useEffect(() => {
    requestScreenshotDetectionPermission().then(setPermission);
  }, []);

  useEffect(() => onScreenshot(() => setShots((n) => n + 1)), []);

  useEffect(
    () => watchAppAway((e) => setAway((prev) => [...prev.slice(-9), e])),
    [],
  );

  useEffect(() => {
    const t = setInterval(() => setSplit(isSplitScreen()), 1000);
    return () => clearInterval(t);
  }, []);

  // Never leave protection held when this screen unmounts.
  useEffect(() => {
    return () => {
      releaseCaptureProtection(TAG);
    };
  }, []);

  const toggle = useCallback(async () => {
    if (armed) {
      await releaseCaptureProtection(TAG);
      setArmed(false);
      setArmError(null);
      return;
    }
    const res = await armCaptureProtection(TAG);
    setArmed(res.armed);
    setArmError(res.reason ?? null);
  }, [armed]);

  const relevant = CHECKS.filter(
    (k) => k.platform === 'both' || k.platform === Platform.OS,
  );
  const criticals = relevant.filter((k) => k.critical);
  const passed = criticals.filter((k) => verdicts[k.id] === 'pass').length;
  const failed = criticals.filter((k) => verdicts[k.id] === 'fail').length;

  const gate: Verdict =
    failed > 0 ? 'fail' : passed === criticals.length ? 'pass' : 'unknown';

  const share = useCallback(() => {
    const lines = [
      'SabiPass anti-cheat spike',
      `${Platform.OS} ${Platform.Version} · ${Device.modelName ?? 'unknown model'}`,
      `screenshot-detection permission: ${permission}`,
      `screenshots detected while armed: ${shots}`,
      `split-screen detected: ${split}`,
      `app-away events: ${away.map((a) => `${a.msAway}ms${a.isStrike ? '*' : ''}`).join(', ') || 'none'}`,
      '',
      ...relevant.map(
        (k) =>
          `[${verdicts[k.id] === 'pass' ? 'PASS' : verdicts[k.id] === 'fail' ? 'FAIL' : '  ? '}] ${k.critical ? '(critical) ' : ''}${k.title}`,
      ),
      '',
      `GATE: ${gate.toUpperCase()}`,
    ];
    Share.share({ message: lines.join('\n') });
  }, [permission, shots, split, away, relevant, verdicts, gate]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header title="Anti-cheat spike" onHome={() => router.replace('/home')} />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.eyebrow}>PHASE 1 · GO / NO-GO</Text>
        <Text style={s.h1}>Anti-cheat spike</Text>
        <Text style={s.sub}>
          {Platform.OS} {String(Platform.Version)} · {Device.modelName ?? 'unknown model'}
        </Text>

        <Pressable
          onPress={toggle}
          style={[s.armBtn, armed ? s.armBtnOn : s.armBtnOff]}
          accessibilityRole="button"
          accessibilityState={{ selected: armed }}
        >
          <Text style={[s.armText, armed && { color: c.onAccent }]}>
            {armed ? 'PROTECTION ARMED — tap to disarm' : 'ARM PROTECTION'}
          </Text>
        </Pressable>

        {armError ? <Text style={s.err}>Could not arm: {armError}</Text> : null}

        <View style={s.card}>
          <Text style={s.cardTitle}>Detected automatically</Text>
          <Row label="Screenshot-detection permission" value={String(permission)} c={c} />
          <Row
            label="Screenshots detected"
            value={String(shots)}
            hint={armed && shots > 0 ? 'fired while ARMED — blocking may be failing' : undefined}
            bad={armed && shots > 0}
            c={c}
          />
          <Row label="Split-screen right now" value={split ? 'yes' : 'no'} bad={split} c={c} />
          <Row
            label="App-away events"
            value={away.length ? away.map((a) => `${a.msAway}ms${a.isStrike ? '*' : ''}`).join('  ') : 'none yet'}
            hint="Leave the app and come back. * = past the 2s strike threshold."
            c={c}
          />
        </View>

        <Text style={s.cardTitle}>Confirm by hand</Text>
        {relevant.map((k) => (
          <CheckRow
            key={k.id}
            check={k}
            verdict={verdicts[k.id] ?? 'unknown'}
            onSet={(v) => setVerdicts((prev) => ({ ...prev, [k.id]: v }))}
            c={c}
          />
        ))}

        <View
          style={[
            s.gate,
            {
              borderColor:
                gate === 'pass' ? c.correct : gate === 'fail' ? c.wrong : c.border,
            },
          ]}
        >
          <Text style={s.cardTitle}>
            Gate: {passed}/{criticals.length} critical checks passed
          </Text>
          <Text style={s.gateText}>
            {gate === 'pass'
              ? 'GO — the locked-environment premise holds. Proceed.'
              : gate === 'fail'
                ? 'NO-GO on at least one critical check. The app still works on the 15s timer alone (PLAN §2.3), but say so honestly in the UI rather than claiming a locked environment.'
                : 'Incomplete — work through every critical check on this device.'}
          </Text>
        </View>

        <Pressable onPress={share} style={s.shareBtn} accessibilityRole="button">
          <Text style={s.shareText}>Share results</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  hint,
  bad,
  c,
}: {
  label: string;
  value: string;
  hint?: string;
  bad?: boolean;
  c: Colors;
}) {
  return (
    <View style={{ paddingVertical: space.sm, gap: 2 }}>
      <Text style={{ ...font.label, color: c.textMuted }}>{label}</Text>
      <Text style={{ ...font.mono, color: bad ? c.wrong : c.text }}>{value}</Text>
      {hint ? (
        <Text style={{ ...font.label, fontWeight: '400', color: bad ? c.wrong : c.textMuted }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function CheckRow({
  check,
  verdict,
  onSet,
  c,
}: {
  check: Check;
  verdict: Verdict;
  onSet: (v: Verdict) => void;
  c: Colors;
}) {
  const border =
    verdict === 'pass' ? c.correct : verdict === 'fail' ? c.wrong : c.border;

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderColor: border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: space.lg,
        gap: space.sm,
      }}
    >
      <Text style={{ ...font.heading, color: c.text }}>
        {check.critical ? '● ' : '○ '}
        {check.title}
      </Text>
      <Text style={{ ...font.body, fontSize: 14, color: c.textMuted, lineHeight: 20 }}>
        {check.how}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {(['pass', 'fail'] as const).map((v) => {
          const on = verdict === v;
          const tint = v === 'pass' ? c.correct : c.wrong;
          return (
            <Pressable
              key={v}
              onPress={() => onSet(on ? 'unknown' : v)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: on ? tint : c.border,
                backgroundColor: on ? tint : 'transparent',
              }}
            >
              <Text
                style={{
                  ...font.label,
                  color: on ? (v === 'pass' ? '#08130C' : '#1A0A08') : c.textMuted,
                }}
              >
                {v.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: space.xl, gap: space.lg, paddingBottom: space.xxxl },
    eyebrow: { ...font.label, color: c.accent },
    h1: { ...font.display, color: c.text },
    sub: { ...font.mono, color: c.textMuted, marginTop: -space.sm },
    armBtn: {
      minHeight: TAP_TARGET,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    armBtnOn: { backgroundColor: c.accent, borderColor: c.accent },
    armBtnOff: { backgroundColor: 'transparent', borderColor: c.border },
    armText: { ...font.heading, color: c.text },
    err: { ...font.body, fontSize: 14, color: c.wrong },
    card: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: space.lg,
    },
    cardTitle: { ...font.heading, color: c.text, marginBottom: space.xs },
    gate: {
      borderWidth: 1,
      borderRadius: radius.md,
      padding: space.lg,
      gap: space.sm,
      backgroundColor: c.surface,
    },
    gateText: { ...font.body, fontSize: 14, color: c.textMuted, lineHeight: 20 },
    shareBtn: {
      minHeight: TAP_TARGET,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shareText: { ...font.heading, color: c.text },
  });
}

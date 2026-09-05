/**
 * Report or block a study partner (App Store 1.2).
 *
 * A username is the only text one player writes that another player reads, and
 * that is enough to make this app a UGC surface in review terms: there has to
 * be a way to report it and a way to never be paired with that person again.
 *
 * Collapsed by default. The overwhelming majority of matches need none of this,
 * and a report button competing with the score would be its own kind of noise.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { Body, ErrorNote } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useColors } from '@/lib/useColors';
import type { ReportReason } from '@/lib/types';
import { font, radius, space, TAP_TARGET } from '@/theme';

const REASONS: { key: ReportReason; label: string }[] = [
  { key: 'offensive_username', label: 'Offensive username' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'cheating', label: 'Cheating' },
  { key: 'other', label: 'Something else' },
];

export function ReportPlayer({
  userId,
  username,
  matchId,
}: {
  userId: string;
  username: string;
  matchId?: string;
}) {
  const c = useColors();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<'reported' | 'blocked' | null>(null);

  const finish = (outcome: 'reported' | 'blocked') => {
    setDone(outcome);
    setOpen(false);
    // Matchmaking now excludes this player; anything listing them is stale.
    qc.invalidateQueries({ queryKey: ['blocked'] });
    qc.invalidateQueries({ queryKey: ['matches'] });
  };

  const report = useMutation({
    mutationFn: (reason: ReportReason) => api.reportUser(userId, { reason, matchId }),
    onSuccess: () => finish('reported'),
  });

  const block = useMutation({
    mutationFn: () => api.blockUser(userId),
    onSuccess: () => finish('blocked'),
  });

  const busy = report.isPending || block.isPending;
  const failure = report.error ?? block.error;

  if (done) {
    return (
      <Body muted>
        {done === 'reported'
          ? `Thanks — we have your report. ${username} will not be matched with you again.`
          : `${username} is blocked and will not be matched with you again.`}
      </Body>
    );
  }

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={{ minHeight: TAP_TARGET, justifyContent: 'center' }}
      >
        <Text style={{ ...font.label, color: c.textMuted }}>
          REPORT OR BLOCK {username.toUpperCase()}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      <Body muted>Why are you reporting {username}?</Body>

      {REASONS.map((r) => (
        <Pressable
          key={r.key}
          disabled={busy}
          onPress={() => report.mutate(r.key)}
          accessibilityRole="button"
          style={{
            minHeight: TAP_TARGET,
            justifyContent: 'center',
            paddingHorizontal: space.lg,
            backgroundColor: c.surface,
            borderColor: c.border,
            borderWidth: 1,
            borderRadius: radius.md,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={{ ...font.body, color: c.text }}>{r.label}</Text>
        </Pressable>
      ))}

      {/* Blocking without filing a report is a legitimate thing to want. */}
      <Pressable
        disabled={busy}
        onPress={() => block.mutate()}
        accessibilityRole="button"
        style={{ minHeight: TAP_TARGET, justifyContent: 'center', opacity: busy ? 0.5 : 1 }}
      >
        <Text style={{ ...font.label, color: c.accent }}>JUST BLOCK — NO REPORT</Text>
      </Pressable>

      <Pressable
        onPress={() => setOpen(false)}
        accessibilityRole="button"
        style={{ minHeight: TAP_TARGET, justifyContent: 'center' }}
      >
        <Text style={{ ...font.label, color: c.textMuted }}>CANCEL</Text>
      </Pressable>

      {failure ? (
        <ErrorNote
          message={
            failure instanceof ApiError
              ? failure.message
              : 'Could not send that. Check your connection and try again.'
          }
        />
      ) : null}
    </View>
  );
}

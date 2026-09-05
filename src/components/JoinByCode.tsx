import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { TextInput, View } from 'react-native';
import { Body, Button, ErrorNote } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useColors } from '@/lib/useColors';
import { font, radius, space, TAP_TARGET } from '@/theme';

/** Accepts a pasted code or a full sabipass://duel/CODE link. */
export function extractCode(input: string): string {
  const trimmed = input.trim();
  const fromLink = trimmed.match(/duel\/([A-Za-z0-9]+)/);
  return (fromLink?.[1] ?? trimmed).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function JoinByCode({ initialCode = '' }: { initialCode?: string }) {
  const c = useColors();
  const qc = useQueryClient();
  const [code, setCode] = useState(initialCode);

  const join = useMutation({
    mutationFn: (value: string) => api.joinMatch({ inviteCode: extractCode(value) }),
    onSuccess: (match) => {
      qc.invalidateQueries({ queryKey: ['matches'] });
      router.push(`/lobby/${match.matchId}`);
    },
  });

  const message =
    join.error instanceof ApiError
      ? join.error.message
      : join.isError
        ? 'Could not join. Check your connection and try again.'
        : null;

  return (
    <View style={{ gap: space.sm }}>
      <Body muted>Got a code from a friend?</Body>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="CHALLENGE CODE"
          placeholderTextColor={c.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          style={{
            flex: 1,
            minHeight: TAP_TARGET,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            color: c.text,
            ...font.option,
            letterSpacing: 2,
          }}
        />
        <View style={{ width: 110 }}>
          <Button
            label="Join"
            onPress={() => join.mutate(code)}
            busy={join.isPending}
            disabled={extractCode(code).length < 4}
          />
        </View>
      </View>
      {message ? <ErrorNote message={message} /> : null}
    </View>
  );
}

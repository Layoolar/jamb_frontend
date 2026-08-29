import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ApiError, api } from '@/lib/api';
import { useColors } from '@/lib/useColors';
import {
  Body,
  Button,
  ErrorNote,
  Eyebrow,
  Loading,
  Screen,
  Title,
} from '@/components/ui';
import { font, radius, space } from '@/theme';

const QUESTIONS_NEEDED = 10;

export default function Subjects() {
  const c = useColors();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === 'duel' ? 'duel' : 'solo';

  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjects = useQuery({ queryKey: ['subjects'], queryFn: api.subjects });

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const match =
        mode === 'duel'
          ? await api.joinMatch({ subjectSlug: selected ?? undefined })
          : await api.createMatch(selected ?? undefined, 'solo');
      router.replace(`/lobby/${match.matchId}`);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not start. Check your connection and try again.',
      );
      setBusy(false);
    }
  };

  if (subjects.isLoading) {
    return (
      <Screen scroll={false}>
        <Loading label="Loading subjects" />
      </Screen>
    );
  }

  // Pools are disjoint, so a subject can have enough to duel on but not enough
  // to practise, or the reverse. Count the pool for the mode being played.
  const rows = subjects.data?.subjects ?? [];
  const countFor = (s: (typeof rows)[number]) =>
    mode === 'duel' ? s.duelQuestions : s.practiceQuestions;
  const playable = rows.filter((s) => countFor(s) >= QUESTIONS_NEEDED);

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Eyebrow>{mode === 'duel' ? 'DUEL' : 'PRACTICE'}</Eyebrow>
        <Title>Pick a subject</Title>
        <Body muted>Ten questions, fifteen seconds each.</Body>
      </View>

      {subjects.isError ? (
        <ErrorNote message="Could not load subjects. Check your connection and try again." />
      ) : null}

      <View style={{ gap: space.sm }}>
        <SubjectRow
          name="Mixed"
          detail="Questions from every subject"
          active={selected === null}
          onPress={() => setSelected(null)}
        />
        {playable.map((s) => (
          <SubjectRow
            key={s.slug}
            name={s.name}
            detail={`${countFor(s)} questions`}
            active={selected === s.slug}
            onPress={() => setSelected(s.slug)}
          />
        ))}
      </View>

      {rows.length > playable.length ? (
        <Text style={{ ...font.label, color: c.textMuted }}>
          SUBJECTS WITH FEWER THAN {QUESTIONS_NEEDED} {mode === 'duel' ? 'DUEL' : 'PRACTICE'}{' '}
          QUESTIONS ARE HIDDEN
        </Text>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}

      <View style={{ flex: 1 }} />

      <Button
        label={mode === 'duel' ? 'Find an opponent' : 'Start practice'}
        onPress={start}
        busy={busy}
      />
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );

  function SubjectRow({
    name,
    detail,
    active,
    onPress,
  }: {
    name: string;
    detail: string;
    active: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        style={{
          minHeight: 64,
          borderWidth: 1,
          borderColor: active ? c.accent : c.border,
          backgroundColor: active ? c.surfaceAlt : c.surface,
          borderRadius: radius.md,
          paddingHorizontal: space.lg,
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Text style={{ ...font.heading, color: c.text }}>{name}</Text>
        <Text style={{ ...font.label, color: c.textMuted }}>
          {detail.toUpperCase()}
        </Text>
      </Pressable>
    );
  }
}

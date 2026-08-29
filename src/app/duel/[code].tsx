/**
 * Deep-link landing for `sabipass://duel/ABC12345`, the link shared into
 * WhatsApp groups.
 *
 * It does NOT auto-join. A tapped link should not silently commit someone to a
 * timed match — they land on Home with the code filled in and press Join
 * themselves. It also means a signed-out user keeps the code through sign-in
 * instead of losing it to a redirect.
 */

import { Redirect, useLocalSearchParams } from 'expo-router';
import { Loading, Screen } from '@/components/ui';
import { extractCode } from '@/components/JoinByCode';
import { useAuth } from '@/store/auth';

export default function DuelLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const status = useAuth((s) => s.status);

  if (status === 'loading') {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }

  const clean = extractCode(code ?? '');

  if (status === 'signedOut') {
    return <Redirect href={`/sign-in?code=${clean}`} />;
  }

  return <Redirect href={`/home?code=${clean}`} />;
}

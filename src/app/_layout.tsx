import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setUnauthenticatedHandler } from '@/lib/api';
import { syncPushToken } from '@/lib/notifications';
import { useAuth } from '@/store/auth';
import { colors } from '@/theme';

/**
 * Sentry. Optional — with EXPO_PUBLIC_SENTRY_DSN unset this is a no-op, so a
 * dev build needs no account. Android device diversity in this market will
 * surface crashes no simulator reproduces, so turn it on before the beta.
 */
if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    // Off in dev so local errors don't burn quota.
    enabled: !__DEV__,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

// Must be called before the first render, hence module scope rather than an effect.
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // Nigerian mobile data drops constantly; a refetch storm on every
      // reconnect is worse than slightly stale stats.
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const c = colors[scheme];
  const status = useAuth((s) => s.status);
  const restore = useAuth((s) => s.restore);
  const forceSignOut = useAuth((s) => s.forceSignOut);

  useEffect(() => {
    setUnauthenticatedHandler(forceSignOut);
    restore();
  }, [restore, forceSignOut]);

  /**
   * Hold the native splash until auth has resolved.
   *
   * Without this the splash hides the moment JS mounts, and the boot gate then
   * shows a spinner while SecureStore is read and /auth/me is called — so a
   * cold start flashes splash, blank, spinner, home. On a low-end Android with
   * a 4MB Hermes bundle that sequence is very visible.
   *
   * It is NOT held any longer than that. A launch screen should make launch
   * feel instant, not serve as a logo showcase; when auth resolves in 150ms the
   * splash should be gone in 150ms.
   */
  useEffect(() => {
    if (status === 'loading') return;
    SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  /**
   * A rotated push token would otherwise never be re-uploaded — permission is
   * asked once, on the first duel result, and never revisited. See syncPushToken.
   */
  useEffect(() => {
    if (status !== 'signedIn') return;
    void syncPushToken();
  }, [status]);

  /**
   * Tapping a "you won / you lost" notification opens that match's result.
   * Handles both a cold start from a notification and a tap while running.
   */
  const [pendingMatch, setPendingMatch] = useState<string | null>(null);

  useEffect(() => {
    const take = (data: unknown) => {
      const matchId = (data as { matchId?: string } | null)?.matchId;
      if (typeof matchId === 'string' && matchId) setPendingMatch(matchId);
    };

    Notifications.getLastNotificationResponseAsync()
      .then((res) => {
        if (res) take(res.notification.request.content.data);
      })
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      take(res.notification.request.content.data);
    });

    return () => sub.remove();
  }, []);

  /**
   * Navigate only once auth has actually resolved.
   *
   * A cold start from a notification wins the race against SecureStore every
   * time, so pushing immediately dropped a result screen on top of the sign-in
   * screen, where its fetch 401'd. Holding the id instead means a tap that
   * arrives signed-out still lands correctly the moment sign-in completes.
   */
  useEffect(() => {
    if (!pendingMatch || status !== 'signedIn') return;
    setPendingMatch(null);
    router.push(`/result/${pendingMatch}`);
  }, [pendingMatch, status]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg },
            animation: 'slide_from_right',
          }}
        >
          {/* The question screen must not be swipe-dismissable mid-answer. */}
          <Stack.Screen
            name="play/[matchId]"
            options={{ gestureEnabled: false, animation: 'fade' }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

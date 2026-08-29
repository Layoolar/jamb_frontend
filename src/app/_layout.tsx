import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setUnauthenticatedHandler } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { colors } from '@/theme';

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
  const restore = useAuth((s) => s.restore);
  const forceSignOut = useAuth((s) => s.forceSignOut);

  useEffect(() => {
    setUnauthenticatedHandler(forceSignOut);
    restore();
  }, [restore, forceSignOut]);

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

import { create } from 'zustand';
import { api } from '@/lib/api';
import { clearSession, loadSession } from '@/lib/session';
import type { PublicUser } from '@/lib/types';

type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: PublicUser | null;
  restore: () => Promise<void>;
  setUser: (user: PublicUser) => void;
  signOut: () => Promise<void>;
  forceSignOut: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  restore: async () => {
    const session = await loadSession();
    if (!session) {
      set({ status: 'signedOut', user: null });
      return;
    }
    set({ status: 'signedIn', user: session.user });

    // Confirm the token still works and pick up a renamed username.
    try {
      const me = await api.me();
      set({ user: me.user });
    } catch {
      await clearSession();
      set({ status: 'signedOut', user: null });
    }
  },

  setUser: (user) => set({ status: 'signedIn', user }),

  signOut: async () => {
    await api.logout();
    set({ status: 'signedOut', user: null });
  },

  /** Called by the API layer when a refresh fails and cannot be recovered. */
  forceSignOut: () => set({ status: 'signedOut', user: null }),
}));

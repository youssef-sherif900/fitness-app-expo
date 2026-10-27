import { create } from 'zustand';
import * as endpoints from '@/api/endpoints';
import { tokenStore, setSessionExpiredHandler } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { resetDb } from '@/db';
import type { User } from '@/api/types';
import * as SecureStore from 'expo-secure-store';
import { clearLocalFlag, isOnboarded, readLocalFlag, writeLocalFlag } from '@/onboarding/status';

type S = {
  status: 'loading' | 'in' | 'out';
  user: User | null;
  mode: 'client' | 'trainer';
  onboarded: boolean;
  setMode: (mode: 'client' | 'trainer') => Promise<void>;
  bootstrap: () => Promise<void>;
  acceptAuthResponse: (res: any) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  signOut: (opts?: { remote?: boolean }) => Promise<void>;
};

export const useSession = create<S>((set) => ({

  mode: 'client',
  status: 'loading',
  user: null,
  onboarded: false,

  async setMode(mode) {
    const user = useSession.getState().user;

    if (!user) {
      throw new Error('You must be signed in to change modes.');
    }

    const canUseClient = user.is_client === true;
    const canUseTrainer = user.is_trainer === true;

    if (mode === 'client' && !canUseClient) {
      throw new Error('Your account does not have client access.');
    }

    if (mode === 'trainer' && !canUseTrainer) {
      throw new Error('Your account does not have trainer access.');
    }

    await SecureStore.setItemAsync('fitness-app-mode', mode);
    set({ mode });
  },


  async bootstrap() {
    const { access } = await tokenStore.get();
    if (!access) return set({ status: 'out' });
    try {
      const user = await endpoints.getMe();
      const savedMode = await SecureStore.getItemAsync('fitness-app-mode');

      const mode =
        savedMode === 'trainer' && user.is_trainer === true
          ? 'trainer'
          : savedMode === 'client' && user.is_client === true
            ? 'client'
            : user.is_trainer === true && user.is_client !== true
              ? 'trainer'
              : 'client';

      set({
        user,
        mode,
        onboarded: await isOnboarded(user),
        status: 'in',
      });
    } catch (e: any) {
      // offline at launch: keep the session, local data still works
      if (e?.isOffline) set({ status: 'in', onboarded: await readLocalFlag() });
      else set({ status: 'out' });
    }
  },

  async acceptAuthResponse(res: any) {
    const access = res.access_token ?? res.token;
    if (!access) throw new Error('Sign-in response had no token. Check the /auth/login response shape.');
    await tokenStore.set(access, res.refresh_token ?? null);
    // /me is the source of truth for profile and onboarding state
    const user = await endpoints.getMe().catch(() => res.user ?? null);
    set({ user, onboarded: await isOnboarded(user), status: 'in' });
  },

  async completeOnboarding() {
    await writeLocalFlag();
    const user = await endpoints.getMe().catch(() => null);
    set((s) => ({ user: user ?? s.user, onboarded: true }));
  },

  async signOut({ remote = true } = {}) {
    if (remote) await endpoints.logout().catch(() => { });
    await tokenStore.clear();
    await SecureStore.deleteItemAsync('fitness-app-mode');
    await clearLocalFlag();
    await resetDb();
    queryClient.clear();
    set({ user: null, onboarded: false, status: 'out' });
  },
}));

setSessionExpiredHandler(() => {
  void useSession.getState().signOut({ remote: false });
});
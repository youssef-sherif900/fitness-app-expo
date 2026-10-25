import { create } from 'zustand';
import * as endpoints from '@/api/endpoints';
import { tokenStore, setSessionExpiredHandler } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { resetDb } from '@/db';
import type { User } from '@/api/types';

type S = {
  status: 'loading' | 'in' | 'out';
  user: User | null;
  bootstrap: () => Promise<void>;
  acceptAuthResponse: (res: any) => Promise<void>;
  signOut: (opts?: { remote?: boolean }) => Promise<void>;
};

export const useSession = create<S>((set, get) => ({
  status: 'loading',
  user: null,

  async bootstrap() {
    const { access } = await tokenStore.get();
    if (!access) return set({ status: 'out' });
    try {
      const user = await endpoints.getMe();
      set({ user, status: 'in' });
    } catch (e: any) {
      // offline at launch: keep the session, local data still works
      if (e?.isOffline) set({ status: 'in' });
      else set({ status: 'out' });
    }
  },

  async acceptAuthResponse(res: any) {
    const access = res.access_token ?? res.token;
    if (!access) throw new Error('Sign-in response had no token. Check the /auth/login response shape.');
    await tokenStore.set(access, res.refresh_token ?? null);
    const user = res.user ?? (await endpoints.getMe());
    set({ user, status: 'in' });
  },

  async signOut({ remote = true } = {}) {
    if (remote) await endpoints.logout().catch(() => {});
    await tokenStore.clear();
    await resetDb();
    queryClient.clear();
    set({ user: null, status: 'out' });
  },
}));

setSessionExpiredHandler(() => {
  void useSession.getState().signOut({ remote: false });
});

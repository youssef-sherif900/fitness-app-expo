import * as SecureStore from 'expo-secure-store';

const FLAG = 'onboarded';

/** Local fallback so a backend without an onboarding flag doesn't loop users back into onboarding. */
export const readLocalFlag = async () => (await SecureStore.getItemAsync(FLAG)) === '1';
export const writeLocalFlag = () => SecureStore.setItemAsync(FLAG, '1');
export const clearLocalFlag = () => SecureStore.deleteItemAsync(FLAG);

/**
 * Preferred signal: an explicit flag on GET /me. Next: a profile that has the essentials.
 * Last: the local flag. Adjust once the real /me shape is confirmed in docs/api.json.
 */
export async function isOnboarded(user: any): Promise<boolean> {
    if (typeof user?.onboarding_completed === 'boolean') return user.onboarding_completed;
    const p = user?.profile;
    const has = (...keys: string[]) => keys.some((k) => p?.[k] !== undefined && p?.[k] !== null && p?.[k] !== '');
    if (p && has('height_cm', 'height') && has('weight_kg', 'weight') && has('activity_level', 'activity') && has('goal', 'goal_type')) {
        return true;
    }
    return readLocalFlag();
}
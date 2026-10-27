import { create } from 'zustand';

export type Goal = 'lose' | 'maintain' | 'gain';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type Draft = {
    goal: Goal | null;
    sex: 'female' | 'male' | null;
    birthDate: string;
    heightCm: string;
    weightKg: string;
    targetWeightKg: string;
    activity: Activity | null;
    rateKg: number | null;
    diet: string[];
    allergies: string[];
};

const empty: Draft = {
    goal: null, sex: null, birthDate: '', heightCm: '', weightKg: '', targetWeightKg: '',
    activity: null, rateKg: null, diet: [], allergies: [],
};

type S = {
    draft: Draft;
    result: any | null;
    set: (patch: Partial<Draft>) => void;
    setResult: (r: any | null) => void;
    reset: () => void;
};

export const useOnboarding = create<S>((set) => ({
    draft: empty,
    result: null,
    set: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
    setResult: (result) => set({ result }),
    reset: () => set({ draft: empty, result: null }),
}));

/** Single place that maps the draft to the PUT /me/profile body. Confirm names against docs/api.json. */
export function buildProfilePayload(d: Draft) {
    return {
        goal: {
            type: d.goal,
            target_weight_kg: d.targetWeightKg
                ? parseFloat(d.targetWeightKg.replace(',', '.'))
                : null,
            weekly_rate_kg: d.goal === 'maintain' ? 0 : d.rateKg,
        },
        sex: d.sex,
        birth_date: d.birthDate,
        height_cm: parseFloat(d.heightCm.replace(',', '.')),
        weight_kg: parseFloat(d.weightKg.replace(',', '.')),
        activity_level: d.activity,
        diet_preferences: d.diet,
        allergies: d.allergies,
    };
}

/** Steps shown to the user. Maintain skips the weekly-rate step. */
export const stepCount = (goal: Goal | null) => (goal === 'maintain' ? 5 : 6);

/** Pull plain-language notes out of a server response, whatever key they arrive under. */
export function collectNotices(res: any): string[] {
    if (!res || typeof res !== 'object') return [];
    const out: string[] = [];
    for (const k of ['messages', 'warnings', 'guardrails', 'notices', 'notes', 'message']) {
        const v = res[k];
        if (typeof v === 'string' && v) out.push(v);
        else if (Array.isArray(v)) v.forEach((x) => typeof x === 'string' ? out.push(x) : x?.message && out.push(String(x.message)));
    }
    return [...new Set(out)];
}

/** Which onboarding screen to send the user back to for a given API field. */
export function screenForField(field: string): { path: string; label: string } {
    if (/rate|pace|weekly/.test(field)) return { path: '/rate', label: 'Adjust weekly pace' };
    if (/activity/.test(field)) return { path: '/activity', label: 'Adjust activity level' };
    if (/height|weight|birth|age|sex/.test(field)) return { path: '/body', label: 'Adjust body stats' };
    return { path: '/goal', label: 'Adjust goal' };
}
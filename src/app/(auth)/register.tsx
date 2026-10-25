import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen, Txt, Button } from '@/components/ui';
import { FormInput } from '@/components/FormInput';
import * as endpoints from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session';

const schema = z.object({
  name: z.string().min(1, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
});
type Form = z.infer<typeof schema>;

export default function Register() {
  const router = useRouter();
  const [formError, setFormError] = useState('');
  const { control, handleSubmit, setError, formState: { isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    setFormError('');
    try {
      const res = await endpoints.register(v.name.trim(), v.email.trim(), v.password);
      await useSession.getState().acceptAuthResponse(res);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        for (const [k, msgs] of Object.entries(e.fields)) if (k in v) setError(k as keyof Form, { message: msgs[0] });
      } else setFormError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  });

  return (
    <Screen>
      <Txt variant="title">Create your account</Txt>
      <FormInput control={control} name="name" label="Name" autoComplete="name" autoFocus />
      <FormInput control={control} name="email" label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <FormInput control={control} name="password" label="Password" secureTextEntry autoComplete="new-password" />
      {formError ? <Txt variant="muted">{formError}</Txt> : null}
      <Button title="Create account" onPress={onSubmit} loading={isSubmitting} />
      <Button title="I already have an account" variant="text" onPress={() => router.back()} />
    </Screen>
  );
}

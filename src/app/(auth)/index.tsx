import React, { useState } from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen, Txt, Button } from '@/components/ui';
import { FormInput } from '@/components/FormInput';
import * as endpoints from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session';

const schema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
type Form = z.infer<typeof schema>;

export default function SignIn() {
  const [formError, setFormError] = useState('');
  const { control, handleSubmit, setError, formState: { isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    setFormError('');
    try {
      const res = await endpoints.login(v.email.trim(), v.password);
      await useSession.getState().acceptAuthResponse(res);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        for (const [k, msgs] of Object.entries(e.fields)) if (k in v) setError(k as keyof Form, { message: msgs[0] });
      } else setFormError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  });

  return (
    <Screen>
      <View style={{ height: 40 }} />
      <Txt variant="title">Welcome back</Txt>
      <FormInput control={control} name="email" label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" autoFocus />
      <FormInput control={control} name="password" label="Password" secureTextEntry autoComplete="password" />
      {formError ? <Txt variant="muted">{formError}</Txt> : null}
      <Button title="Sign in" onPress={onSubmit} loading={isSubmitting} />
      <Link href="/(auth)/register" asChild><Button title="Create an account" variant="text" onPress={() => {}} /></Link>
    </Screen>
  );
}

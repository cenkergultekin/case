'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { getFirebaseAuth } from '@/lib/firebaseClient';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';

type Mode = 'login' | 'register';

export const AuthForm = () => {
  const auth = getFirebaseAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'idle' | 'error'; message?: string }>({ type: 'idle' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ type: 'idle' });
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: error?.message || 'İşlem başarısız oldu.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">ImageFlow</h1>
          <p className="mt-2 text-sm text-gray-600">
            Devam etmek için {mode === 'login' ? 'giriş yapın' : 'kayıt olun'}.
          </p>
        </div>

        <div className="mb-6 flex rounded-full border border-gray-200 bg-gray-100 p-1 text-sm font-semibold text-gray-600">
          <button
            type="button"
            className={`flex-1 rounded-full py-2 transition ${
              mode === 'login' ? 'bg-white text-gray-900 shadow' : ''
            }`}
            onClick={() => setMode('login')}
          >
            Giriş Yap
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full py-2 transition ${
              mode === 'register' ? 'bg-white text-gray-900 shadow' : ''
            }`}
            onClick={() => setMode('register')}
          >
            Kayıt Ol
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">E-Posta</label>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="ornek@mail.com"
              value={email}
              onChange={event => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Şifre</label>
            <input
              type="password"
              required
              minLength={6}
              className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="••••••••"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </div>
          <Button
            className="w-full rounded-2xl py-3 text-base font-semibold"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Gönderiliyor…' : mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
          </Button>
        </form>

        {status.type === 'error' && status.message && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{status.message}</p>
        )}
        <p className="mt-6 text-center text-xs text-gray-500">
          Tüm görsel işlemleri gerçekleştirmek için hesabınızla giriş yapmanız gerekir.
        </p>
      </div>
    </div>
  );
};


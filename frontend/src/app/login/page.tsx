'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  const { usuario } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Si ya está autenticado, redirigir al dashboard
    if (usuario) {
      router.push('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]); // Remover router de las dependencias para evitar ciclo infinito

  // Si ya está autenticado, no mostrar nada (se redirigirá)
  if (usuario) {
    return null;
  }

  return (
    <LoginForm 
      onSuccess={() => {
        router.push('/');
      }}
    />
  );
}

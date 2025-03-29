import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useTheme } from 'next-themes';
import { useEffect, useCallback } from 'react';

import { ThemeProvider } from '@/components/ThemeProvider';
import { brandingConfig } from '@/config/brandingConfig';
import { UserProvider, useUserContext } from '@/context/UserContext';
import '@/styles/globals.css';
import { initializePostHog } from '@/lib/posthog-client';

function MyAppContent({ Component, pageProps }: AppProps) {
  const { setTheme } = useTheme();
  const { isAuthenticated, isSuperUser, authState } = useUserContext();
  const router = useRouter();

  useEffect(() => {
    // Set theme and initialize PostHog
    setTheme(brandingConfig.theme);
    initializePostHog();

    // 🛰️ Patch fetch to log outgoing HTTP requests and responses
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const [resource, config] = args;

      console.log('📡 [FETCH] HTTP Request');
      console.log('→ URL:', resource);
      console.log('→ Method:', config?.method || 'GET');
      console.log('→ Headers:', config?.headers);
      console.log('→ Body:', config?.body);

      const response = await originalFetch(...args);

      const cloned = response.clone();
      const responseBody = await cloned.text();

      console.log('📨 [FETCH] HTTP Response');
      console.log('← Status:', response.status);
      console.log('← Body:', responseBody);

      return response;
    };
  }, []);

  const checkAccess = useCallback(async () => {
    const publicRoutes = ['/auth/login', '/auth/signup'];
    const userRoutes = [
      '/documents',
      '/collections',
      '/collection',
      '/chat',
      '/account',
    ];
    const currentPath = router.pathname;

    const isUserRoute = (path: string) => {
      return userRoutes.some((route) => path.startsWith(route));
    };

    if (!isAuthenticated) {
      if (!publicRoutes.includes(currentPath)) {
        router.replace('/auth/login');
      }
      return;
    }

    if (isSuperUser()) {
      return;
    }

    if (!isUserRoute(currentPath)) {
      router.replace('/documents');
    }
  }, [isAuthenticated, isSuperUser, authState.userRole, router]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  return <Component {...pageProps} />;
}

function MyApp(props: AppProps) {
  // Move the runtime config check into useEffect
  useEffect(() => {
    // Load the env-config.js script dynamically
    const script = document.createElement('script');
    script.src = '/env-config.js';
    script.onload = () => {
      if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) {
        console.log('Runtime Config:', window.__RUNTIME_CONFIG__);
      } else {
        console.warn('Runtime Config not found!');
      }
    };
    document.body.appendChild(script);
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <UserProvider>
        <MyAppContent {...props} />
      </UserProvider>
    </ThemeProvider>
  );
}

export default MyApp;

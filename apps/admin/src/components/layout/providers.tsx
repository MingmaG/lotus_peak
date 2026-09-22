'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import * as React from 'react';

/**
 * React Query and the theme.
 *
 * The client is created inside `useState` rather than at module scope. At
 * module scope it is shared by every request the server handles, which in a
 * server-rendered app means one visitor's cached enquiry list can be handed to
 * the next — a data leak that looks like a caching bug.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * Thirty seconds. Long enough that moving between two screens and
             * back does not refetch, short enough that a colleague's edit
             * shows up without a reload.
             */
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              /* A 401 or a 403 will not become a 200 by asking again. */
              const status = (error as { status?: number })?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

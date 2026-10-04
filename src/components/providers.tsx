'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { useState } from 'react';
import { ChatProvider } from '@/contexts/ChatContext';
import { MqttSupabaseListener } from '@/components/MqttSupabaseListener';
import { PresenceTracker } from '@/components/PresenceTracker';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ChatProvider>
          <PresenceTracker />
          <MqttSupabaseListener />
          {children}
        </ChatProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

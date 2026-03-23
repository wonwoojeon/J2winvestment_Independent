import type { AuthChangeEvent } from '@supabase/supabase-js';

const marketAnalysisRefreshEvents = new Set<AuthChangeEvent>(['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED']);

export const shouldRefreshMarketAnalysisForAuthEvent = (event: AuthChangeEvent) =>
  marketAnalysisRefreshEvents.has(event);

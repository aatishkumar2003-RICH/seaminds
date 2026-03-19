import { supabase } from '@/integrations/supabase/client';

export const logEvent = async (
  event_type: string,
  message: string,
  severity: 'info' | 'warning' | 'error' = 'info',
  metadata: Record<string, any> = {}
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('app_events').insert({
      event_type,
      message,
      severity,
      user_id: user?.id || null,
      metadata,
    });
  } catch (e) {
    console.error('logEvent failed:', e);
  }
};

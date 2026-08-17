import { supabase } from '@/lib/supabase';

export async function trackEvent({
  eventType,
  itemId,
  categoryId,
  tableNumber,
}: {
  eventType: string;
  itemId?: string;
  categoryId?: string;
  tableNumber?: string;
}) {
  try {
    const { error } = await supabase
      .from('analytics_events')
      .insert({
        id: crypto.randomUUID(),
        event_type: eventType,
        item_id: itemId ?? null,
        category_id: categoryId ?? null,
        table_number: tableNumber ?? null,
        timestamp: new Date().toISOString(),
        user_agent:
          typeof navigator !== 'undefined'
            ? navigator.userAgent
            : null,
        referer:
          typeof document !== 'undefined'
            ? document.referrer || null
            : null,
      });

   if (error) {
  console.error('Analytics error details:', {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
}
  } catch (error) {
    console.error('Failed to track analytics event:', error);
  }
}
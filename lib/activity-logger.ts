import { supabase } from '@/lib/supabase';

export interface ActionLogInput {
  action_type: 'ORDER_CANCELLED' | 'ORDER_PAID' | 'ORDER_UPDATED' | 'EXPENSE_ADDED' | 'EXPENSE_DELETED' | 'INVENTORY_UPDATED' | 'GENERAL';
  description: string;
  performed_by?: string | null;
  role?: string | null;
  target_id?: string | null;
  metadata?: any;
}

/**
 * Log an administrative or operational action to the action_logs table
 */
export async function logAction(input: ActionLogInput) {
  try {
    const payload = {
      action_type: input.action_type,
      description: input.description,
      performed_by: input.performed_by || 'System Admin',
      role: input.role || 'admin',
      target_id: input.target_id || null,
      metadata: input.metadata || {},
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('action_logs').insert(payload);

    if (error) {
      console.warn('Supabase action_logs insert notice:', error.message);
    }
  } catch (err) {
    console.error('Failed to record action log:', err);
  }
}

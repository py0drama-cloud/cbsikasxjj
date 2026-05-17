import "server-only";

import { createServiceSupabaseClient } from "@/lib/supabase/server";

export type WalletCurrency = "STARS" | "ROBUX";

export type WalletMutation = {
  userId: string;
  currency: WalletCurrency;
  amount: number;
  type: string;
  reason: string;
  refType?: string | null;
  refId?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
};

export async function adjustUserBalance(input: WalletMutation) {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.rpc("adjust_user_balance", {
    p_user_id: input.userId,
    p_currency: input.currency,
    p_amount: input.amount,
    p_type: input.type,
    p_reason: input.reason,
    p_ref_type: input.refType || null,
    p_ref_id: input.refId || null,
    p_created_by: input.createdBy || null,
    p_metadata: input.metadata || {},
  });

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data) ? data[0] : data;
}

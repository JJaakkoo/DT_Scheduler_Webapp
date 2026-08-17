import { createClient } from '@supabase/supabase-js';

// WARNING: This client bypasses Row Level Security (RLS) entirely.
// It MUST ONLY be used in secure Server Actions or secure API routes.
// DO NOT expose this client to the browser.
export const createAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

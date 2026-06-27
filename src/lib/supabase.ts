import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Client dùng trong Server Components và browser (anon key)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Client dùng trong API routes cần bypass RLS (service key)
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey
);

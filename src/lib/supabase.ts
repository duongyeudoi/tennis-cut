import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY ?? "placeholder";

// Client dùng trong Server Components và browser (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client dùng trong API routes cần bypass RLS (service key)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

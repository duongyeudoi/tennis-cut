import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY ?? "placeholder";

// Browser client dùng trong Client Components — session lưu trong cookie
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Admin client dùng trong API routes — bypass RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

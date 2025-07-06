// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;

NEXT_PUBLIC_SUPABASE_URL: url;
NEXT_PUBLIC_SUPABASE_KEY: key;


export const supabase = createClient(url, key);

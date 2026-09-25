import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://psvovfskhqthdhcrwaqy.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdm92ZnNraHF0aGRoY3J3YXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNTAzOTIsImV4cCI6MjEwNTkyNjM5Mn0.3oL5_X3sYPAzwjfp5QTRhnnIFHJLds77WLIim-lFB6g";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

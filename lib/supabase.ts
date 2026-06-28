import { createClient } from '@supabase/supabase-js';

type SupabaseClientInstance = ReturnType<typeof createClient<Database>>;

let supabaseClient: SupabaseClientInstance | undefined;

export function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  supabaseClient ??= createClient<Database>(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

// 型定義
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      people: {
        Row: {
          id: string;
          name: string;
          role: string | null;
          age: number | null;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          role?: string | null;
          age?: number | null;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          role?: string | null;
          age?: number | null;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          color: string;
          subcategories: string[];
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color: string;
          subcategories: string[];
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          subcategories?: string[];
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          description: string;
          amount: number;
          category: string;
          subcategory: string | null;
          date: string;
          paid_by: string;
          payment_method: string | null;
          beneficiaries: string[];
          comment: string | null;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          description: string;
          amount: number;
          category: string;
          subcategory?: string | null;
          date: string;
          paid_by: string;
          payment_method?: string | null;
          beneficiaries: string[];
          comment?: string | null;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          description?: string;
          amount?: number;
          category?: string;
          subcategory?: string | null;
          date?: string;
          paid_by?: string;
          payment_method?: string | null;
          beneficiaries?: string[];
          comment?: string | null;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};

// Jodi App - Supabase Client Configuration
// Uses real @supabase/supabase-js when environment variables are configured
// Falls back to MockSupabaseClient for development without backend

import { createClient, SupabaseClient as RealSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_MOCK } from "../config";
import { Profile } from "../types";

// ============ Shared Interface ============

export interface AppSupabaseClient {
  auth: {
    signUp: (credentials: {
      email: string;
      password: string;
    }) => Promise<{ data: any; error: any }>;
    signIn: (credentials: {
      email: string;
      password: string;
    }) => Promise<{ data: any; error: any }>;
    signOut: () => Promise<{ error: any }>;
    getSession: () => Promise<{ data: { session: any }; error: any }>;
    onAuthStateChange: (
      callback: (event: string, session: any) => void
    ) => {
      data: { subscription: { unsubscribe: () => void } };
    };
  };
  from: (table: string) => any;
  channel: (name: string) => any;
  storage: {
    from: (bucket: string) => any;
  };
}

// ============ Real Supabase Client ============

let realClient: AppSupabaseClient | null = null;

function getRealClient(): AppSupabaseClient {
  if (!realClient) {
    try {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      realClient = {
        auth: client.auth,
        from: (table: string) => client.from(table),
        channel: (name: string) => client.channel(name),
        storage: {
          from: (bucket: string) => client.storage.from(bucket),
        },
      };
      console.log("[Supabase] Real client initialized");
    } catch (error) {
      console.error("[Supabase] Failed to create real client:", error);
      throw error;
    }
  }
  return realClient;
}

// ============ Mock Supabase Client (Fallback) ============

class MockSupabaseClient implements AppSupabaseClient {
  private authListeners: Array<(event: string, session: any) => void> = [];

  auth = {
    signUp: async (credentials: { email: string; password: string }) => {
      console.log("[Mock Supabase] signUp:", credentials.email);
      return {
        data: { user: { id: "mock-user-id", email: credentials.email } },
        error: null,
      };
    },
    signIn: async (credentials: { email: string; password: string }) => {
      console.log("[Mock Supabase] signIn:", credentials.email);
      return {
        data: {
          session: {
            user: { id: "mock-user-id", email: credentials.email },
            access_token: "mock-token",
          },
        },
        error: null,
      };
    },
    signOut: async () => {
      console.log("[Mock Supabase] signOut");
      return { error: null };
    },
    getSession: async () => {
      return {
        data: {
          session: {
            user: { id: "mock-user-id", email: "user@example.com" },
            access_token: "mock-token",
          },
        },
        error: null,
      };
    },
    onAuthStateChange: (
      callback: (event: string, session: any) => void
    ) => {
      this.authListeners.push(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.authListeners = [];
            },
          },
        },
      };
    },
  };

  from(table: string) {
    console.log(`[Mock Supabase] from('${table}')`);
    return {
      select: (columns?: string) => ({
        eq: (field: string, value: any) => ({
          single: async () => ({ data: null, error: null }),
          order: (col: string, opts?: any) => ({
            limit: (n: number) => ({
              range: (from: number, to: number) =>
                Promise.resolve({ data: [], error: null }),
              data: [],
              error: null,
            }),
            data: [],
            error: null,
          }),
          data: [],
          error: null,
        }),
        neq: (field: string, value: any) => ({
          not: (field2: string, op: string, val: any) => ({
            data: [],
            error: null,
          }),
          data: [],
          error: null,
        }),
        in: (field: string, values: any[]) => ({
          data: [],
          error: null,
        }),
        contains: (field: string, value: any) => ({
          data: [],
          error: null,
        }),
        data: [],
        error: null,
      }),
      insert: (data: any) => ({
        select: () => ({
          single: async () => ({ data, error: null }),
        }),
      }),
      update: (data: any) => ({
        eq: (field: string, value: any) => ({
          select: () => ({
            single: async () => ({ data, error: null }),
          }),
        }),
      }),
      upsert: (data: any) => ({
        select: () => ({
          single: async () => ({ data, error: null }),
        }),
      }),
    };
  }

  channel(name: string) {
    console.log(`[Mock Supabase] channel('${name}')`);
    return {
      on: (event: string, filter: any, callback: any) => this,
      subscribe: () => this,
    };
  }

  storage = {
    from: (bucket: string) => ({
      upload: async (path: string, file: any) => ({
        data: { path },
        error: null,
      }),
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://mock.supabase.co/${path}` },
      }),
      list: async (prefix?: string) => ({ data: [], error: null }),
      remove: async (paths: string[]) => ({ data: [], error: null }),
    }),
  };
}

// ============ Active Client Export ============

// The active client is determined by environment variables:
// - If EXPO_PUBLIC_SUPABASE_URL is set → real Supabase client
// - Otherwise → mock client for development
export const supabase: AppSupabaseClient = IS_MOCK
  ? new MockSupabaseClient()
  : getRealClient();

// Export the class for testing/inspection
export { MockSupabaseClient };

// Log the mode on import
console.log(
  `[Supabase] Running in ${IS_MOCK ? "MOCK" : "REAL"} mode (${
    IS_MOCK ? "no Supabase env vars" : "connected to " + SUPABASE_URL
  })`
);

export default supabase;
import "react";

declare global {
  namespace JSX {
    interface ElementClass {
      [key: string]: any;
    }

    interface ElementAttributesProperty {
      [key: string]: any;
    }
  }
}

declare module "@supabase/supabase-js" {
  export type User = any;
  export type Session = any;

  interface SupabaseAuthClient {
    getSession(...args: any[]): Promise<any>;
    onAuthStateChange(...args: any[]): any;
    signUp(...args: any[]): Promise<any>;
    signInWithPassword(...args: any[]): Promise<any>;
    signOut(...args: any[]): Promise<any>;
    resetPasswordForEmail(...args: any[]): Promise<any>;
    getUser(...args: any[]): Promise<any>;
  }
}

export {};

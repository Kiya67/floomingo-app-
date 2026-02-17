
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { Session, User } from "@supabase/supabase-js";

interface SupabaseAuthContextType {
  user: User | null;
  session: Session | null;
  loadingAuth: boolean;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    console.log('SupabaseAuthProvider - Initializing auth state');
    
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('SupabaseAuthProvider - Error getting initial session:', error);
        }
        
        console.log('SupabaseAuthProvider - Initial session loaded:', !!session, 'user:', session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('SupabaseAuthProvider - Failed to initialize auth:', error);
        setSession(null);
        setUser(null);
      } finally {
        setLoadingAuth(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('SupabaseAuthProvider - Auth state changed:', _event, !!session, 'user:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      setLoadingAuth(false);
    });

    return () => {
      console.log('SupabaseAuthProvider - Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        loadingAuth,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  }
  return context;
}

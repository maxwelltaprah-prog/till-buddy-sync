import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, UserRole, AppRole, Branch } from '@/types/database';
import { toast } from 'sonner';
import { clockSkewSeconds, describeSkew, CLOCK_SKEW_KEY, CLOCK_SKEW_LIMIT_SECONDS } from '@/lib/clockSkew';
import { canOpenScreen, SCREENS, STAFF_ROLES, type ScreenOverride } from '@/lib/screenAccess';

export interface StoreInfo { id: string; name: string }

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  branch: Branch | null;
  isLoading: boolean;
  isPlatformOwner: boolean;
  store: StoreInfo | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  refreshProfile: () => Promise<void>;
  screenOverrides: ScreenOverride[];
  canAccessScreen: (path: string) => boolean;
  accessError: string | null;
}

// Reuse one context across hot reloads so provider and consumers always match.
const globalRef = globalThis as unknown as { __authContext?: React.Context<AuthContextType | undefined> };
const AuthContext = (globalRef.__authContext ??= createContext<AuthContextType | undefined>(undefined));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [screenOverrides, setScreenOverrides] = useState<ScreenOverride[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);

  const loadedUserRef = useRef<string | null>(null);
  const requestRef = useRef(0);

  // Load profile, roles and store status together. A failed or slow lookup is retried and never
  // treated as "no role" or "store closed" — only a confirmed answer from the server changes access.
  const fetchUserData = async (userId: string) => {
    const requestId = ++requestRef.current;
    const loadOnce = () => Promise.all([
      supabase.from('profiles').select('*, branch:branches(*)').eq('user_id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('platform_owners').select('user_id').eq('user_id', userId).maybeSingle(),
      supabase.rpc('my_store_status'),
    ]);
    try {
      let results = await loadOnce();
      for (let attempt = 1; attempt < 4 && results.some((r) => r.error); attempt++) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        if (requestId !== requestRef.current) return;
        results = await loadOnce();
      }
      if (requestId !== requestRef.current) return;
      const [profileRes, rolesRes, ownerRes, statusRes] = results;
      const failed = results.find((r) => r.error)?.error;
      if (failed) {
        console.error('Account load failed:', failed);
        setAccessError("We couldn't load your account. Check your internet connection and try again.");
        return;
      }
      const profileData = profileRes.data;
      const owner = !!ownerRes.data;
      const status = statusRes.data as string | null;
      if (!owner && profileData?.store_id && (status === 'inactive' || status === 'archived')) {
        setProfile(null); setRoles([]); setBranch(null); setStore(null); setIsPlatformOwner(false);
        loadedUserRef.current = null;
        await supabase.auth.signOut();
        toast.error('Your store is inactive or archived. Contact the platform owner.');
        return;
      }
      const { data: storeRow } = profileData?.store_id
        ? await supabase.from('stores').select('id, name').eq('id', profileData.store_id).maybeSingle()
        : { data: null };
      const { data: accessRows, error: screenError } = profileData?.store_id
        ? await supabase.from('role_screen_access').select('role, screen, enabled').eq('store_id', profileData.store_id)
        : { data: [], error: null };
      if (requestId !== requestRef.current) return;

      const branchData = (profileData?.branch ?? null) as Branch | null;
      setProfile(profileData ? ({ ...profileData, branch: branchData ?? undefined } as Profile) : null);
      setBranch(branchData);
      setRoles((rolesRes.data ?? []).map((r) => r.role as AppRole));
      setIsPlatformOwner(owner);
      setStore((storeRow as StoreInfo | null) ?? null);
      if (screenError) {
        console.error("Error fetching screen access:", screenError);
        setScreenOverrides(STAFF_ROLES.flatMap(role => SCREENS.map(screen => ({ role, screen: screen.path, enabled: false }))));
      } else setScreenOverrides((accessRows ?? []) as ScreenOverride[]);
      setAccessError(null);
      loadedUserRef.current = userId;
    } catch (error) {
      console.error('Error in fetchUserData:', error);
      if (requestId === requestRef.current) setAccessError("We couldn't load your account. Check your internet connection and try again.");
    }
  };

  const clearUserData = () => {
    requestRef.current++;
    loadedUserRef.current = null;
    setProfile(null); setRoles([]); setBranch(null); setStore(null);
    setIsPlatformOwner(false); setScreenOverrides([]); setAccessError(null);
  };

  // Initialize auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (event === 'SIGNED_IN' && currentSession?.access_token) {
          const skew = clockSkewSeconds(currentSession.access_token);
          if (skew !== null && Math.abs(skew) > CLOCK_SKEW_LIMIT_SECONDS) {
            localStorage.setItem(CLOCK_SKEW_KEY, String(skew));
            toast.error(describeSkew(skew), { duration: 20000 });
          } else {
            localStorage.removeItem(CLOCK_SKEW_KEY);
          }
        }

        const uid = currentSession?.user?.id;
        if (!uid) { clearUserData(); return; }
        // Token refreshes don't change who is signed in; only load when the account changes.
        if (loadedUserRef.current === uid && event !== 'USER_UPDATED') return;
        if (loadedUserRef.current !== uid) setIsLoading(true);
        // Defer Supabase calls to avoid a deadlock inside the auth callback.
        setTimeout(() => { void fetchUserData(uid).finally(() => setIsLoading(false)); }, 0);
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user) {
        fetchUserData(existingSession.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || isPlatformOwner) return;
    const interval = window.setInterval(() => { void fetchUserData(user.id); }, 30000);
    return () => window.clearInterval(interval);
  }, [user?.id, isPlatformOwner]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (!error && data.user) {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          full_name: fullName,
          email: email,
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        return { error: profileError as unknown as Error };
      }
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  const hasAnyRole = (checkRoles: AppRole[]): boolean => {
    return checkRoles.some((role) => roles.includes(role));
  };

  const hasPermission = (permission: string): boolean => {
    // Import ROLE_PERMISSIONS dynamically to avoid circular dependency
    const { ROLE_PERMISSIONS } = require('@/types/database');
    return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    roles,
    branch,
    isLoading,
    isPlatformOwner,
    store,
    signIn,
    signUp,
    signOut,
    hasRole,
    hasAnyRole,
    hasPermission,
    refreshProfile,
    screenOverrides,
    accessError,
    canAccessScreen: (path) => canOpenScreen(roles, path, screenOverrides, isPlatformOwner),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

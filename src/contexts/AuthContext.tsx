import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, UserRole, AppRole, Branch } from '@/types/database';
import { toast } from 'sonner';
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

  // Fetch user profile and roles
  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile with branch
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, branch:branches(*)')
        .eq('user_id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      if (profileData) {
        const branchData = profileData.branch as Branch | null;
        setProfile({
          ...profileData,
          branch: branchData ?? undefined,
        } as Profile);
        setBranch(branchData);
      }

      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      }

      if (rolesData) {
        setRoles(rolesData.map((r) => r.role as AppRole));
      }

      const [{ data: ownerRow }, { data: storeRow }] = await Promise.all([
        supabase.from('platform_owners').select('user_id').eq('user_id', userId).maybeSingle(),
        profileData?.store_id
          ? supabase.from('stores').select('id, name, is_active, archived_at').eq('id', profileData.store_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!ownerRow && profileData?.store_id && (!storeRow || !storeRow.is_active || storeRow.archived_at)) {
        setProfile(null); setRoles([]); setBranch(null); setStore(null); setIsPlatformOwner(false);
        await supabase.auth.signOut();
        toast.error('Your store is inactive or archived. Contact the platform owner.');
        return;
      }
      setIsPlatformOwner(!!ownerRow);
      setStore(storeRow as StoreInfo | null);
      const { data: accessRows, error: accessError } = profileData?.store_id
        ? await supabase.from('role_screen_access').select('role, screen, enabled').eq('store_id', profileData.store_id)
        : { data: [], error: null };
      if (accessError) {
        console.error('Error fetching screen access:', accessError);
        setScreenOverrides(STAFF_ROLES.flatMap(role => SCREENS.map(screen => ({ role, screen: screen.path, enabled: false }))));
      } else setScreenOverrides((accessRows ?? []) as ScreenOverride[]);
    } catch (error) {
      console.error('Error in fetchUserData:', error);
    }
  };

  // Initialize auth state
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // Defer Supabase calls with setTimeout to prevent deadlock
        if (currentSession?.user) {
          setTimeout(() => {
            fetchUserData(currentSession.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setBranch(null);
          setStore(null);
          setIsPlatformOwner(false);
          setScreenOverrides([]);
        }
        
        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setRoles([]);
          setBranch(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      if (existingSession?.user) {
        fetchUserData(existingSession.user.id).finally(() => {
          setIsLoading(false);
        });
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

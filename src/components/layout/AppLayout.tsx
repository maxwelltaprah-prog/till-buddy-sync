import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, WifiOff } from 'lucide-react';
import { OfflineStatus } from '@/components/OfflineStatus';
import { NotificationBell } from './NotificationBell';
import { useShopSettings } from '@/contexts/ShopSettingsContext';
import { SCREENS } from '@/lib/screenAccess';

export function AppLayout() {
  const { user, isLoading, profile, roles, branch, store, canAccessScreen, accessError, refreshProfile, signOut } = useAuth();
  const { settings: shopSettings } = useShopSettings();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isFullBleed = pathname === '/pos';
  const isAdmin = roles.includes('admin' as any);
  const [branchList, setBranchList] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!isAdmin || !store?.id) return;
    supabase.from('branches').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setBranchList(data || []));
  }, [isAdmin, store?.id]);
  const switchBranch = async (id: string) => {
    if (!user || id === branch?.id) return;
    const { error } = await supabase.from('profiles').update({ branch_id: id }).eq('user_id', user.id);
    if (error) { toast.error('Could not switch branch'); return; }
    await refreshProfile();
    toast.success(`Switched to ${branchList.find((b) => b.id === id)?.name ?? 'branch'}`);
  };

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }
  // A failed lookup is a connection problem, never "no role": offer a retry instead.
  if (accessError && (!profile || roles.length === 0)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex max-w-md flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/20">
            <WifiOff className="h-8 w-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold">Couldn't load your account</h1>
          <p className="text-muted-foreground">{accessError}</p>
          <div className="flex gap-2">
            <Button onClick={() => void refreshProfile()}>Try again</Button>
            <Button variant="outline" onClick={() => void signOut()}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }
  if (!profile) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!canAccessScreen(pathname)) {
    const firstScreen = SCREENS.find(screen => canAccessScreen(screen.path));
    return <Navigate to={firstScreen?.path ?? '/profile'} replace />;
  }

  // Check if user has roles assigned
  if (roles.length === 0 && profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-md p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/20">
            <WifiOff className="h-8 w-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold">No Access Role</h1>
          <p className="text-muted-foreground">
            Your account hasn't been assigned a role yet. Please contact your administrator to get access to the system.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <div className="flex flex-1 items-center gap-2 text-sm">
            {(shopSettings.shop_name || store?.name) && <span className="font-medium text-foreground">{shopSettings.shop_name || store?.name}</span>}
            {store && (branch || (isAdmin && branchList.length > 0)) && <span className="text-muted-foreground">/</span>}
            {isAdmin && branchList.length > 0 ? (
              <Select value={branch?.id ?? ''} onValueChange={switchBranch}>
                <SelectTrigger className="h-8 w-auto min-w-[150px] gap-2 text-sm" aria-label="Switch branch">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>{branchList.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : branch && (
              <Badge variant="secondary" className="font-normal">
                {branch.name}
              </Badge>
            )}
          </div>
          <NotificationBell />
          <OfflineStatus branchId={branch?.id} />
        </header>

        <main className="flex-1 overflow-auto bg-muted/30">
          {isFullBleed ? (
            <Outlet />
          ) : (
            <div className="page-shell mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
              <Outlet />
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

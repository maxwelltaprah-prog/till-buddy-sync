import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, WifiOff } from 'lucide-react';
import { OfflineStatus } from '@/components/OfflineStatus';
import { NotificationBell } from './NotificationBell';
import { useShopSettings } from '@/contexts/ShopSettingsContext';

export function AppLayout() {
  const { user, isLoading, profile, roles, branch, store } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isFullBleed = pathname === '/pos';

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
            {store && branch && <span className="text-muted-foreground">/</span>}
            {branch && (
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

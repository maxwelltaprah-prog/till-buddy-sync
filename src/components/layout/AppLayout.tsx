import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, WifiOff } from 'lucide-react';
import { OfflineStatus } from '@/components/OfflineStatus';

export function AppLayout() {
  const { user, isLoading, profile, roles, branch } = useAuth();
  const navigate = useNavigate();

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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          
          <div className="flex items-center gap-2 flex-1">
            {branch && (
              <Badge variant="outline" className="font-normal">
                {branch.name}
              </Badge>
            )}
          </div>


          <div className="flex items-center gap-2">
            {/* Offline status indicator with sync */}
            <OfflineStatus branchId={branch?.id} />
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

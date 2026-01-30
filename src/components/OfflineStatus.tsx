import { useState, useEffect } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface OfflineStatusProps {
  branchId?: string;
}

export function OfflineStatus({ branchId }: OfflineStatusProps) {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncAt,
    error,
    isInitialized,
    triggerSync,
  } = useOfflineSync(branchId);

  if (!isInitialized) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4 text-success" />
              <span className="hidden sm:inline text-muted-foreground">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-destructive" />
              <span className="hidden sm:inline text-destructive">Offline</span>
            </>
          )}
          {pendingCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {pendingCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Cloud className="h-5 w-5 text-success" />
              ) : (
                <CloudOff className="h-5 w-5 text-destructive" />
              )}
              <div>
                <p className="font-medium">
                  {isOnline ? 'Connected' : 'Offline Mode'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isOnline
                    ? 'All data syncing to cloud'
                    : 'Data saved locally'}
                </p>
              </div>
            </div>
          </div>

          {pendingCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pending sync</span>
                <span className="font-medium">{pendingCount} items</span>
              </div>
              {isSyncing && (
                <div className="space-y-1">
                  <Progress value={undefined} className="h-1" />
                  <p className="text-xs text-muted-foreground">Syncing...</p>
                </div>
              )}
            </div>
          )}

          {lastSyncAt && (
            <div className="text-xs text-muted-foreground">
              Last synced: {format(lastSyncAt, 'MMM d, HH:mm')}
            </div>
          )}

          {error && (
            <div className="text-xs text-destructive">
              Sync error: {error}
            </div>
          )}

          {isOnline && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={triggerSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync Now
            </Button>
          )}

          {!isOnline && (
            <p className="text-xs text-muted-foreground text-center">
              Your sales will be saved locally and synced when you're back online.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

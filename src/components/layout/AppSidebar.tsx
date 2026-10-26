import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useShopSettings } from '@/contexts/ShopSettingsContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Store,
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Boxes,
  Building2,
  Truck,
  RotateCcw,
  ChevronUp,
  Grid3X3,
  ClipboardList,
  ArrowLeftRight,
  CalendarClock,
  Upload,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { ROLE_LABELS } from '@/types/database';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles?: string[];
}

const mainNavItems: NavItem[] = [
  {
    title: 'POS Terminal',
    url: '/pos',
    icon: ShoppingCart,
    roles: ['admin', 'cashier'],
  },
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: BarChart3,
    roles: ['admin', 'branch_supervisor'],
  },
];

const inventoryNavItems: NavItem[] = [
  {
    title: 'Products',
    url: '/products',
    icon: Package,
    roles: ['admin', 'stock_manager'],
  },
  {
    title: 'Categories',
    url: '/categories',
    icon: Grid3X3,
    roles: ['admin'],
  },
  {
    title: 'Inventory',
    url: '/inventory',
    icon: Boxes,
    roles: ['admin', 'stock_manager', 'branch_supervisor'],
  },
  {
    title: 'Stock Movements',
    url: '/stock-movements',
    icon: ClipboardList,
    roles: ['admin', 'stock_manager'],
  },
  { title: 'Stock Transfers', url: '/stock-transfers', icon: ArrowLeftRight, roles: ['admin', 'stock_manager'] },
  { title: 'Expiry Ageing', url: '/expiry', icon: CalendarClock, roles: ['admin', 'stock_manager', 'branch_supervisor'] },
  { title: 'Bulk Import', url: '/bulk-import', icon: Upload, roles: ['admin', 'stock_manager'] },
];

const operationsNavItems: NavItem[] = [
  {
    title: 'Suppliers',
    url: '/suppliers',
    icon: Truck,
    roles: ['admin', 'stock_manager'],
  },
  {
    title: 'Returns',
    url: '/returns',
    icon: RotateCcw,
    roles: ['admin', 'cashier', 'branch_supervisor'],
  },
];

const adminNavItems: NavItem[] = [
  {
    title: 'Users',
    url: '/users',
    icon: Users,
    roles: ['admin'],
  },
  {
    title: 'Branches',
    url: '/branches',
    icon: Building2,
    roles: ['admin'],
  },
  {
    title: 'Reports',
    url: '/reports',
    icon: BarChart3,
    roles: ['admin', 'branch_supervisor'],
  },
  { title: 'Profit Report', url: '/profit', icon: TrendingUp, roles: ['admin', 'branch_supervisor'] },
  { title: 'Tax Settings', url: '/tax-settings', icon: Percent, roles: ['admin'] },
  {
    title: 'Shop Settings',
    url: '/shop-settings',
    icon: Store,
    roles: ['admin'],
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
    roles: ['admin'],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, roles, signOut, isPlatformOwner, store } = useAuth();
  const { settings: shopSettings } = useShopSettings();

  const filterByRole = (items: NavItem[]) => {
    return items.filter(
      (item) => !item.roles || item.roles.some((role) => roles.includes(role as never))
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderNavGroup = (label: string, items: NavItem[]) => {
    const filteredItems = filterByRole(items);
    if (filteredItems.length === 0) return null;

    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {filteredItems.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.url}
                >
                  <Link to={item.url}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link to="/" className="flex items-center gap-3">
          {shopSettings.logo_url ? (
            <img
              src={shopSettings.logo_url}
              alt={shopSettings.shop_name}
              className="h-9 w-9 object-contain rounded-lg"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
              <Store className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground">{shopSettings.shop_name}</span>
            <span className="text-xs text-sidebar-foreground/60">{shopSettings.tagline}</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {isPlatformOwner && (
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/stores'}>
                    <Link to="/stores">
                      <Building2 className="h-4 w-4" />
                      <span>Stores{store ? ` · ${store.name}` : ''}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {renderNavGroup('Main', mainNavItems)}
        {renderNavGroup('Inventory', inventoryNavItems)}
        {renderNavGroup('Operations', operationsNavItems)}
        {renderNavGroup('Administration', adminNavItems)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-auto py-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                      {profile?.full_name ? getInitials(profile.full_name) : '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium truncate max-w-[140px]">
                      {profile?.full_name || 'User'}
                    </span>
                    <span className="text-xs text-sidebar-foreground/60">
                      {roles.length > 0
                        ? ROLE_LABELS[roles[0] as keyof typeof ROLE_LABELS]
                        : 'No role'}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-[--radix-dropdown-menu-trigger-width]"
              >
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <Users className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  Users as UsersIcon,
  Search,
  MoreHorizontal,
  Shield,
  UserPlus,
} from 'lucide-react';
import type { Profile, UserRole, AppRole, Branch } from '@/types/database';
import { ROLE_LABELS } from '@/types/database';
import { AddUserDialog } from '@/components/admin/AddUserDialog';

interface UserWithRoles extends Profile {
  user_roles: UserRole[];
}

export default function Users() {
  const { user: currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('cashier');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [profilesRes, rolesRes, branchesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*, branch:branches(*)')
          .order('full_name'),
        supabase.from('user_roles').select('*'),
        supabase.from('branches').select('*').eq('is_active', true).order('name'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (branchesRes.error) throw branchesRes.error;

      // Combine profiles with their roles
      const profilesWithRoles = (profilesRes.data || []).map((profile) => ({
        ...profile,
        user_roles: (rolesRes.data || []).filter((r) => r.user_id === profile.user_id),
      })) as UserWithRoles[];

      setUsers(profilesWithRoles);
      setBranches(branchesRes.data as Branch[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.full_name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserRoles = (user: UserWithRoles): AppRole[] => {
    return user.user_roles?.map((r) => r.role as AppRole) || [];
  };

  const openRoleDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    const roles = getUserRoles(user);
    setSelectedRole(roles[0] || 'cashier');
    setShowRoleDialog(true);
  };

  const handleAssignRole = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      // First, remove existing roles
      await supabase.from('user_roles').delete().eq('user_id', selectedUser.user_id);

      // Then, add the new role
      const { error } = await supabase.from('user_roles').insert({
        user_id: selectedUser.user_id,
        role: selectedRole,
      });

      if (error) throw error;

      toast.success('Role assigned successfully');
      setShowRoleDialog(false);
      fetchData();
    } catch (error) {
      console.error('Error assigning role:', error);
      toast.error('Failed to assign role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBranch = async (user: UserWithRoles, branchId: string | null) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ branch_id: branchId })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Branch updated');
      fetchData();
    } catch (error) {
      console.error('Error updating branch:', error);
      toast.error('Failed to update branch');
    }
  };

  const handleToggleActive = async (user: UserWithRoles) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;
      toast.success(user.is_active ? 'User deactivated' : 'User activated');
      fetchData();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('Failed to update user status');
    }
  };

  const roleOptions: { value: AppRole; label: string }[] = [
    { value: 'admin', label: 'Administrator' },
    { value: 'branch_supervisor', label: 'Branch Supervisor' },
    { value: 'stock_manager', label: 'Stock Manager' },
    { value: 'cashier', label: 'Cashier' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage user accounts and roles</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAddUserDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <UsersIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {searchQuery ? 'No users found' : 'No users yet'}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const roles = getUserRoles(user);
                const isCurrentUser = user.user_id === currentUser?.id;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {user.full_name}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {roles.map((role) => (
                            <Badge key={role} variant="secondary">
                              {ROLE_LABELS[role]}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No role assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.branch_id || 'none'}
                        onValueChange={(value) =>
                          handleUpdateBranch(user, value === 'none' ? null : value)
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No branch</SelectItem>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openRoleDialog(user)}>
                            <Shield className="mr-2 h-4 w-4" />
                            Assign Role
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(user)}
                            disabled={isCurrentUser}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Role Assignment Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Assign a role to {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as AppRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignRole} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <AddUserDialog
        open={showAddUserDialog}
        onOpenChange={setShowAddUserDialog}
        branches={branches}
        onUserAdded={fetchData}
      />
    </div>
  );
}

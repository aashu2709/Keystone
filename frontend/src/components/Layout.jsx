/**
 * Layout Component — Shadcn UI Redesign
 * Professional sidebar + header shell with role-based navigation.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './notifications/NotificationBell';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { Badge } from '@/components/ui/Badge';
import {
  LayoutDashboard,
  Server,
  KeyRound,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  Users,
  UserPlus,
  Shield,
  FileText,
  ShieldAlert,
  Award,
  Activity,
} from 'lucide-react';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/vms', icon: Server, label: 'My VMs' },
    { path: '/vm-password-reset', icon: KeyRound, label: 'Reset VM Password' },
    { path: '/notifications', icon: Bell, label: 'Notifications' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  const adminNavItems = [
    { path: '/admin/users', icon: Users, label: 'Manage Users' },
    { path: '/admin/vms', icon: Server, label: 'Manage VMs' },
    { path: '/admin/mappings', icon: Shield, label: 'User-VM Mappings' },
    { path: '/admin/remote-users', icon: UserPlus, label: 'Remote Users' },
    { path: '/admin/services', icon: Activity, label: 'Windows Services' },
    { path: '/admin/firewall', icon: ShieldAlert, label: 'Firewall Rules' },
    { path: '/admin/certificates', icon: Award, label: 'Certificates' },
    { path: '/admin/audit', icon: FileText, label: 'Audit Logs' },
  ];

  const NavItem = ({ item }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
        onClick={() => setSidebarOpen(false)}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-[260px] bg-card border-r border-border z-50 flex flex-col",
          "transform transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-base font-bold tracking-tight text-foreground">PassPortal</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-1">
          {userNavItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}

          {isAdmin() && (
            <>
              <div className="pt-4 pb-2">
                <Separator />
                <p className="px-3 pt-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin
                </p>
              </div>
              {adminNavItems.map((item) => (
                <NavItem key={item.path} item={item} />
              ))}
            </>
          )}
        </nav>

        {/* User info at bottom */}
        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <span className="text-sm font-semibold text-primary">
                {user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.full_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="lg:pl-[260px]">
        {/* Top header */}
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <NotificationBell />

            <Separator orientation="vertical" className="h-6" />

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{user?.full_name}</span>
              <Badge variant={user?.role === 'admin' || user?.role === 'superadmin' ? 'purple' : 'secondary'}>
                {user?.role}
              </Badge>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
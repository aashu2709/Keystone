/**
 * Layout Component
 * ================
 * Main layout with sidebar, header, and notification bell.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './notifications/NotificationBell';
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

  // Navigation items
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
    { path: '/admin/firewall', icon: ShieldAlert, label: 'Firewall Rules' },
    { path: '/admin/certificates', icon: Award, label: 'Certificates' },
    { path: '/admin/audit', icon: FileText, label: 'Audit Logs' },
  ];

  const NavItem = ({ item }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        className={`
          flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200
          ${isActive
            ? 'bg-primary-100 text-primary-700'
            : 'text-gray-600 hover:bg-gray-100'
          }
        `}
        onClick={() => setSidebarOpen(false)}
      >
        <item.icon size={20} />
        <span className="font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-30
          transform transition-transform duration-300
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Shield className="text-primary-600" size={28} />
            <span className="font-bold text-lg text-gray-800">PassPortal</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {userNavItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}

          {isAdmin() && (
            <>
              <div className="pt-4 mt-4 border-t">
                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Admin
                </p>
                {adminNavItems.map((item) => (
                  <NavItem key={item.path} item={item} />
                ))}
              </div>
            </>
          )}
        </nav>

        {/* User info at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-700 font-semibold">
                {user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.full_name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Menu size={24} />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            {/* Notification Bell - NEW */}
            <NotificationBell />

            {/* User Info */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-gray-600">{user?.full_name}</span>
              <span className={`
                text-xs px-2 py-0.5 rounded-full
                ${user?.role === 'admin' || user?.role === 'superadmin'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600'
                }
              `}>
                {user?.role}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
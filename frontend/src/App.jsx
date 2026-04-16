/**
 * Main App Component
 * Fixed: Added Toaster for toast notifications
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

// Auth Pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
// User Pages
import Dashboard from "./pages/Dashboard";
import MyVMs from "./pages/MyVMs";
import VMPasswordReset from "./pages/VMPasswordReset";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";

// Admin Pages
import ManageVMs from "./pages/admin/ManageVMs";
import ManageMappings from "./pages/admin/ManageMappings";
import ManageUsers from "./pages/admin/ManageUsers";
import AuditLogs from "./pages/admin/AuditLogs";
import ManageRemoteUsers from "./pages/admin/ManageRemoteUsers";
import ManageFirewall from "./pages/admin/ManageFirewall";
import ManageCertificates from "./pages/admin/ManageCertificates";

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          {/* ============================================ */}
          {/* TOAST NOTIFICATIONS - Shows popup toasts    */}
          {/* ============================================ */}
          <Toaster
            position="top-right"
            reverseOrder={false}
            gutter={8}
            containerStyle={{
              top: 80, // Below the header
            }}
            toastOptions={{
              // Default options for all toasts
              duration: 5000,
              style: {
                background: "#fff",
                color: "#333",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                borderRadius: "8px",
                padding: "12px 16px",
                fontSize: "14px",
                maxWidth: "400px",
              },
              // Success toast style
              success: {
                duration: 5000,
                style: {
                  background: "#ECFDF5",
                  color: "#065F46",
                  border: "1px solid #A7F3D0",
                },
                iconTheme: {
                  primary: "#10B981",
                  secondary: "#fff",
                },
              },
              // Error toast style
              error: {
                duration: 6000,
                style: {
                  background: "#FEF2F2",
                  color: "#991B1B",
                  border: "1px solid #FECACA",
                },
                iconTheme: {
                  primary: "#EF4444",
                  secondary: "#fff",
                },
              },
            }}
          />

          <Routes>
            {/* ============================================ */}
            {/* PUBLIC ROUTES (No authentication required)   */}
            {/* ============================================ */}

            {/* Login page */}
            <Route path="/login" element={<Login />} />

            {/* Signup page */}
            <Route path="/signup" element={<Signup />} />

            {/* Forgot password - request reset email */}
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Reset password - from email link with token */}
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Home page - Redirected to Dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* ============================================ */}
            {/* PROTECTED ROUTES (Authentication required)   */}
            {/* ============================================ */}

            {/* Dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* My VMs list */}
            <Route
              path="/vms"
              element={
                <ProtectedRoute>
                  <Layout>
                    <MyVMs />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* VM Password Reset - for resetting passwords on VMs */}
            <Route
              path="/vm-password-reset"
              element={
                <ProtectedRoute>
                  <Layout>
                    <VMPasswordReset />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Notifications */}
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Notifications />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* User Profile */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================ */}
            {/* ADMIN ROUTES (Admin role required)           */}
            {/* ============================================ */}

            {/* Admin Dashboard - Removed */}

            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <ManageUsers />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/vms"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <ManageVMs />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/mappings"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <ManageMappings />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/audit"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <AuditLogs />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/remote-users"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <ManageRemoteUsers />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/firewall"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <ManageFirewall />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/certificates"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <ManageCertificates />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================ */}
            {/* REDIRECTS                                    */}
            {/* ============================================ */}

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
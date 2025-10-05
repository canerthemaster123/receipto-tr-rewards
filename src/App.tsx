import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/AuthContext";
import { RealtimeNotifications } from "./components/RealtimeNotifications";
import { RequireAdmin } from "./components/RequireAdmin";
import { useUserRole } from "./hooks/useUserRole";
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { ErrorBoundary } from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import AuthCallback from "./components/AuthCallback";
import Dashboard from "./pages/Dashboard";
import UploadReceipt from "./pages/UploadReceipt";
import Rewards from "./pages/Rewards";
import AdminPanel from "./pages/AdminPanel";
import AdminHelp from "./pages/AdminHelp";
import Profile from "./pages/Profile";
import OCRDebugPage from "./pages/OCRDebugPage";
import Settings from "./pages/Settings";
import PointsHistory from "./pages/PointsHistory";
import MyRewards from "./pages/MyRewards";
import Leaderboard from "./pages/Leaderboard";
import GoogleAuthSetup from "./pages/GoogleAuthSetup";
import GoogleOAuthTroubleshoot from "./pages/GoogleOAuthTroubleshoot";
import LeavePreview from "./pages/LeavePreview";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  
  if (isLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RealtimeNotifications />
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route 
              path="/auth" 
              element={
                <PublicRoute>
                  <AuthPage />
                </PublicRoute>
              } 
            />
            <Route 
              path="/auth/callback" 
              element={<AuthCallback />} 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/upload" 
              element={
                <ProtectedRoute>
                  <UploadReceipt />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/rewards"
              element={
                <ProtectedRoute>
                  <Rewards />
                </ProtectedRoute>
              } 
            />
            {/* Admin routes with proper nesting */}
            <Route path="/admin" element={<RequireAdmin />}>
              <Route index element={<AdminPanel />} />
              <Route path="analytics" element={<Analytics />} />
            </Route>
            <Route 
              path="/admin/help" 
              element={
                <ProtectedRoute>
                  <AdminHelp />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <Leaderboard />
                </ProtectedRoute>
              } 
            />
            {/* Debug route - available in development or for admins */}
            <Route 
              path="/debug/ocr" 
              element={
                import.meta.env.DEV ? (
                  <ProtectedRoute>
                    <OCRDebugPage />
                  </ProtectedRoute>
                ) : (
                  <AdminRoute>
                    <OCRDebugPage />
                  </AdminRoute>
                )
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/points-history" 
              element={
                <ProtectedRoute>
                  <PointsHistory />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/my-rewards" 
              element={
                <ProtectedRoute>
                  <MyRewards />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/google-auth-setup" 
              element={<GoogleAuthSetup />} 
            />
            <Route 
              path="/google-troubleshoot" 
              element={<GoogleOAuthTroubleshoot />} 
            />
            <Route 
              path="/leave-preview" 
              element={<LeavePreview />} 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </I18nextProvider>
  </ErrorBoundary>
);

export default App;

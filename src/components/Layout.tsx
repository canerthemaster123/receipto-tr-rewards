import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/enhanced-button';
import LanguageSwitcher from './LanguageSwitcher';
import { 
  Home, 
  Upload, 
  History, 
  Gift, 
  User, 
  Users,
  LogOut, 
  Receipt,
  Menu,
  X,
  Shield,
  Crown
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, userProfile, logout } = useAuth();
  const { isAdmin } = useUserRole();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const navItems = [
    { path: '/dashboard', icon: Home, label: t('navigation.dashboard') },
    { path: '/upload', icon: Upload, label: t('navigation.upload') },
    { path: '/history', icon: History, label: t('navigation.history') },
    { path: '/rewards', icon: Gift, label: t('navigation.rewards') },
    { path: '/referrals', icon: Users, label: t('navigation.referrals') },
    { path: '/leaderboard', icon: Crown, label: t('navigation.leaderboard') },
    { path: '/profile', icon: User, label: t('navigation.profile') },
    ...(isAdmin ? [{ path: '/admin', icon: Shield, label: t('navigation.admin') }] : [])
  ];

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center">
          <Receipt className="h-12 w-12 text-white mx-auto mb-4" />
          <p className="text-white text-lg">Please sign in to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2 hover:scale-105 transition-transform">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <span className="hidden sm:block text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Receipto
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-2 lg:px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden lg:block">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Right Section */}
            <div className="hidden md:flex items-center gap-2 lg:gap-4">
              <LanguageSwitcher />
              
              <div className="hidden lg:flex items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {userProfile?.display_name || user.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {userProfile?.total_points || 0} points
                  </p>
                </div>
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
                data-testid="logout-button"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:ml-2 lg:block">{t('common.logout')}</span>
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMobileMenu}
                className="p-2"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border bg-white">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {/* User Info */}
                <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-muted/30 rounded-lg">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {userProfile?.display_name || user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {userProfile?.total_points || 0} points
                    </p>
                  </div>
                </div>

                {/* Navigation Items */}
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}

                {/* Language Switcher */}
                <div className="px-3 py-2">
                  <LanguageSwitcher />
                </div>

                {/* Logout Button */}
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {t('common.logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
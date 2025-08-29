import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { useUserRole } from '../hooks/useUserRole';
import { usePointsLedger } from '../hooks/usePointsLedger';
import { Copy, User, Award, Shield, HelpCircle, Clock, TrendingUp, Users, Gift, UserPlus, ChevronDown, ChevronUp, Receipt, Search, Filter, CheckCircle, XCircle, Calendar as CalendarIcon, Store, Coins, Eye, SlidersHorizontal, X, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import { useReceiptData } from '../hooks/useReceiptData';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ReceiptImageModal } from '../components/ReceiptImageModal';
import { normalizeMerchant, getCleanMerchantName } from '../utils/merchantNormalization';
import { formatTRY } from '../utils/currency';
import { format } from 'date-fns';
import StreaksAndBadges from '@/components/StreaksAndBadges';

interface PointsLedgerEntry {
  id: string;
  source: string;
  delta: number;
  created_at: string;
  meta: any;
}

interface ReferralData {
  id: string;
  referrer_id: string;
  referred_id: string;
  created_at: string;
  points_awarded: number;
  referred_user: {
    display_name: string;
  };
}

interface ReceiptRecord {
  id: string;
  merchant: string;
  merchant_brand?: string;
  total: number;
  purchase_date: string;
  purchase_time?: string;
  store_address?: string;
  payment_method: string | null;
  status: 'approved' | 'pending' | 'rejected';
  points: number;
  items: string;
  image_url?: string;
  receipt_unique_no?: string;
  fis_no?: string;
  barcode_numbers?: string[];
  created_at: string;
  updated_at: string;
}

interface AdvancedFilters {
  dateRange: {
    from?: Date;
    to?: Date;
  };
  merchantFilter: string;
  statusFilter: string;
  minAmount: string;
  maxAmount: string;
}

const ITEMS_PER_PAGE = 20;

const Profile: React.FC = () => {
  const { user, userProfile, logout } = useAuth();
  const { userRole, isLoading: roleLoading } = useUserRole();
  const { entries: pointsHistory, totalPoints, loading: isLoadingHistory } = usePointsLedger();
  const { receipts, loading: receiptsLoading, stats } = useReceiptData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(userProfile?.display_name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReferralDetails, setShowReferralDetails] = useState(false);
  const [showHistoryDetails, setShowHistoryDetails] = useState(false);
  const [myReferrals, setMyReferrals] = useState<ReferralData[]>([]);
  const [referralStats, setReferralStats] = useState({ totalReferred: 0, totalEarned: 0 });
  
  // Receipt history states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [imageModalData, setImageModalData] = useState<{
    imageUrl?: string;
    fileName: string;
    merchant: string;
    merchantBrand?: string;
    purchaseDate: string;
    receiptId: string;
    receiptUniqueNo?: string;
    fisNo?: string;
    barcodeNumbers?: string[];
  } | null>(null);

  const [filters, setFilters] = useState<AdvancedFilters>({
    dateRange: {},
    merchantFilter: '',
    statusFilter: '',
    minAmount: '',
    maxAmount: ''
  });

  useEffect(() => {
    if (user && showReferralDetails) {
      fetchReferralData();
    }
  }, [user, showReferralDetails]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

  const fetchReferralData = async () => {
    if (!user) return;

    try {
      // Fetch referrals where current user is the referrer
      const { data: referrals, error } = await supabase
        .from('referrals')
        .select(`
          id,
          referrer_id,
          referred_id,
          created_at,
          points_awarded
        `)
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get referred users' names
      if (referrals && referrals.length > 0) {
        const referredIds = referrals.map(r => r.referred_id);
        const { data: users } = await supabase
          .from('users_profile')
          .select('id, display_name')
          .in('id', referredIds);

        const userMap = new Map(users?.map(u => [u.id, u.display_name]) || []);

        const referralsWithNames = referrals.map(ref => ({
          ...ref,
          referred_user: {
            display_name: userMap.get(ref.referred_id) || 'Unknown User'
          }
        }));

        setMyReferrals(referralsWithNames);
        setReferralStats({
          totalReferred: referrals.length,
          totalEarned: referrals.reduce((sum, r) => sum + r.points_awarded, 0)
        });
      }
    } catch (error) {
      console.error('Error fetching referral data:', error);
    }
  };

  // Receipt filtering and helper functions
  const getItemsArray = (items: string): string[] => {
    if (!items) return [];
    return items.split('\n').filter(item => item.trim().length > 0);
  };

  const uniqueMerchants = ['Migros', 'ŞOK', 'A101', 'BİM', 'CarrefourSA', 'File Market', 'Metro', 'Mopaş', 'Happy Center', 'Diğer'];

  const filteredReceipts = React.useMemo(() => {
    let result = receipts;

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      result = result.filter(receipt => {
        const merchantMatch = receipt.merchant.toLowerCase().includes(searchLower);
        const itemsMatch = getItemsArray(receipt.items).some(item => 
          item.toLowerCase().includes(searchLower)
        );
        return merchantMatch || itemsMatch;
      });
    }

    if (filters.dateRange.from || filters.dateRange.to) {
      result = result.filter(receipt => {
        const receiptDate = new Date(receipt.purchase_date);
        const fromDate = filters.dateRange.from;
        const toDate = filters.dateRange.to;
        
        if (fromDate && receiptDate < fromDate) return false;
        if (toDate && receiptDate > toDate) return false;
        return true;
      });
    }

    if (filters.merchantFilter && filters.merchantFilter !== 'all') {
      result = result.filter(receipt => {
        const brandToCheck = receipt.merchant_brand || receipt.merchant;
        return normalizeMerchant(brandToCheck) === filters.merchantFilter;
      });
    }

    if (filters.statusFilter && filters.statusFilter !== 'all') {
      result = result.filter(receipt => receipt.status === filters.statusFilter);
    }

    if (filters.minAmount) {
      const minVal = parseFloat(filters.minAmount);
      if (!isNaN(minVal)) {
        result = result.filter(receipt => parseFloat(receipt.total.toString()) >= minVal);
      }
    }

    if (filters.maxAmount) {
      const maxVal = parseFloat(filters.maxAmount);
      if (!isNaN(maxVal)) {
        result = result.filter(receipt => parseFloat(receipt.total.toString()) <= maxVal);
      }
    }

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [receipts, searchTerm, filters]);

  const paginatedReceipts = React.useMemo(() => {
    return filteredReceipts.slice(0, currentPage * ITEMS_PER_PAGE);
  }, [filteredReceipts, currentPage]);

  const hasMorePages = currentPage * ITEMS_PER_PAGE < filteredReceipts.length;

  const loadMore = () => {
    if (hasMorePages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleViewImage = (receipt: ReceiptRecord) => {
    if (!receipt.image_url) return;
    
    setImageModalData({
      imageUrl: receipt.image_url,
      fileName: receipt.image_url.split('/').pop() || 'receipt.jpg',
      merchant: receipt.merchant,
      merchantBrand: receipt.merchant_brand,
      purchaseDate: receipt.purchase_date,
      receiptId: receipt.id,
      receiptUniqueNo: receipt.receipt_unique_no,
      fisNo: receipt.fis_no,
      barcodeNumbers: receipt.barcode_numbers
    });
    setImageModalOpen(true);
  };

  const getStatusBadge = (status: 'approved' | 'pending' | 'rejected') => {
    switch (status) {
      case 'approved':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Onaylandı
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            Bekliyor
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Reddedildi
          </Badge>
        );
    }
  };

  const clearFilters = () => {
    setFilters({
      dateRange: {},
      merchantFilter: '',
      statusFilter: '',
      minAmount: '',
      maxAmount: ''
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || 
    filters.dateRange.from || 
    filters.dateRange.to ||
    filters.merchantFilter ||
    filters.statusFilter ||
    filters.minAmount ||
    filters.maxAmount;

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'receipt':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'referral':
        return <User className="h-4 w-4 text-secondary" />;
      case 'redemption':
        return <Award className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSourceLabel = (source: string, meta: any) => {
    switch (source) {
      case 'receipt':
        return meta?.merchant ? `Receipt from ${meta.merchant}` : 'Receipt approved';
      case 'referral':
        return meta?.type === 'referrer' ? 'Referral bonus (referred someone)' : 'Referral bonus (signed up)';
      case 'redemption':
        return `Redeemed: ${meta?.reward_name || 'Reward'}`;
      default:
        return 'Points activity';
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !displayName.trim()) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      // Refresh the page to get updated profile data
      window.location.reload();
      toast({
        title: 'Profile updated',
        description: 'Your display name has been updated successfully.',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const copyReferralCode = () => {
    if (userProfile?.referral_code) {
      navigator.clipboard.writeText(userProfile.referral_code);
      toast({
        title: 'Copied!',
        description: 'Referral code copied to clipboard.',
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'moderator':
        return <Award className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'moderator':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Please sign in to view your profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="space-y-6">
          {/* Profile Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email || ''} disabled />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                />
              </div>

              <Button 
                onClick={handleUpdateProfile} 
                disabled={isUpdating || !displayName.trim()}
                className="w-full"
              >
                {isUpdating ? 'Updating...' : 'Update Profile'}
              </Button>
            </CardContent>
          </Card>

          {/* Points & Role */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total Points</span>
                <Badge variant="secondary" className="text-lg px-3 py-1" data-testid="total-points">
                  {totalPoints.toLocaleString()}
                </Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="font-medium">Account Role</span>
                {roleLoading ? (
                  <Badge variant="outline">Loading...</Badge>
                 ) : (
                   <Badge variant={getRoleBadgeVariant(userRole || 'user')} className="flex items-center gap-1">
                     {getRoleIcon(userRole || 'user')}
                     {userRole || 'user'}
                   </Badge>
                 )}
               </div>

               {userRole === 'admin' && (
                 <>
                   <Separator />
                   <div className="flex items-center justify-between">
                     <span className="font-medium">Admin Resources</span>
                     <Link to="/admin/help">
                       <Button variant="outline" size="sm" className="flex items-center gap-1">
                         <HelpCircle className="h-4 w-4" />
                         Admin Guide
                       </Button>
                     </Link>
                   </div>
                 </>
               )}
             </CardContent>
           </Card>

          {/* Referral Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Davetler
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReferralDetails(!showReferralDetails)}
                  className="flex items-center gap-1"
                >
                  {showReferralDetails ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Gizle
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Detayları Göster
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-center mb-1">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-lg font-bold">{referralStats.totalReferred}</p>
                  <p className="text-xs text-muted-foreground">Davet Edilen</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-center mb-1">
                    <Award className="h-4 w-4 text-secondary" />
                  </div>
                  <p className="text-lg font-bold">{referralStats.totalEarned}</p>
                  <p className="text-xs text-muted-foreground">Kazanılan Puan</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-center mb-1">
                    <Gift className="h-4 w-4 text-accent" />
                  </div>
                  <p className="text-lg font-bold">200</p>
                  <p className="text-xs text-muted-foreground">Puan/Davet</p>
                </div>
              </div>

              {/* Referral Code */}
              <div className="space-y-2">
                <Label>Davet Kodunuz</Label>
                <div className="flex gap-2">
                  <Input 
                    value={userProfile?.referral_code || ''} 
                    readOnly 
                    className="font-mono"
                    data-testid="referral-code"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyReferralCode}
                    disabled={!userProfile?.referral_code}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">
                  <strong>Nasıl çalışır:</strong> Davet kodunuzu arkadaşlarınızla paylaşın. 
                  Kodunuzla kayıt olduklarında hem siz hem de onlar 200 puan kazanırsınız!
                </p>
              </div>

              {/* Detailed View */}
              {showReferralDetails && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Davet Ettikleriniz
                  </h4>
                  
                  {myReferrals.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Henüz kimseyi davet etmediniz</p>
                      <p className="text-xs mt-1">Kodunuzu paylaşarak puan kazanmaya başlayın!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myReferrals.map((referral) => (
                        <div key={referral.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                          <div>
                            <p className="font-medium text-sm">{referral.referred_user.display_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(referral.created_at).toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            +{referral.points_awarded}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Streaks & Badges */}
          <StreaksAndBadges />

          {/* Points History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Points History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                      <div className="flex-1">
                        <div className="h-4 w-3/4 bg-muted rounded mb-1 animate-pulse" />
                        <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                      </div>
                      <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : pointsHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No points history yet</p>
                  <p className="text-xs mt-2">Upload receipts or refer friends to start earning points!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {pointsHistory.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      {getSourceIcon(entry.source)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {getSourceLabel(entry.source, entry.meta)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString('tr-TR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <Badge 
                        variant={entry.delta > 0 ? 'default' : 'destructive'}
                        className="font-mono"
                      >
                        {entry.delta > 0 ? '+' : ''}{entry.delta}
                      </Badge>
                    </div>
                  ))}
                  {pointsHistory.length > 10 && (
                    <p className="text-xs text-center text-muted-foreground pt-2">
                      Showing latest 10 entries of {pointsHistory.length} total
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Receipt History Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Fiş Geçmişi
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistoryDetails(!showHistoryDetails)}
                  className="flex items-center gap-1"
                >
                  {showHistoryDetails ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Gizle
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Detayları Göster
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-center mb-1">
                    <Receipt className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-lg font-bold">{stats.totalReceipts}</p>
                  <p className="text-xs text-muted-foreground">Toplam</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-center mb-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-lg font-bold text-green-600">{stats.approvedReceipts}</p>
                  <p className="text-xs text-muted-foreground">Onaylı</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-center mb-1">
                    <Clock className="h-4 w-4 text-yellow-600" />
                  </div>
                  <p className="text-lg font-bold text-yellow-600">{stats.pendingReceipts}</p>
                  <p className="text-xs text-muted-foreground">Bekleyen</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-center mb-1">
                    <Coins className="h-4 w-4 text-secondary" />
                  </div>
                  <p className="text-lg font-bold text-secondary">{stats.totalEarned}</p>
                  <p className="text-xs text-muted-foreground">Toplam Puan</p>
                </div>
              </div>

              {/* Detailed View */}
              {showHistoryDetails && (
                <div className="space-y-4 border-t pt-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Fiş ara (mağaza veya ürün ismi)..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex items-center gap-2"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Filtreler
                      {hasActiveFilters && (
                        <Badge variant="secondary" className="ml-1">
                          {[
                            searchTerm && 'arama',
                            filters.dateRange.from && 'tarih',
                            filters.merchantFilter && 'mağaza',
                            filters.statusFilter && 'durum',
                            (filters.minAmount || filters.maxAmount) && 'tutar'
                          ].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4" />
                        Temizle
                      </Button>
                    )}
                  </div>

                  {/* Advanced Filters Panel */}
                  {showFilters && (
                    <div className="p-4 border rounded-lg bg-muted/20 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Date Range */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Tarih Aralığı</label>
                          <div className="flex gap-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="flex-1 justify-start text-left">
                                  <CalendarIcon className="h-4 w-4 mr-2" />
                                  {filters.dateRange.from ? format(filters.dateRange.from, 'dd/MM/yyyy') : 'Başlangıç'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={filters.dateRange.from}
                                  onSelect={(date) => setFilters(prev => ({
                                    ...prev,
                                    dateRange: { ...prev.dateRange, from: date }
                                  }))}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="flex-1 justify-start text-left">
                                  <CalendarIcon className="h-4 w-4 mr-2" />
                                  {filters.dateRange.to ? format(filters.dateRange.to, 'dd/MM/yyyy') : 'Bitiş'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={filters.dateRange.to}
                                  onSelect={(date) => setFilters(prev => ({
                                    ...prev,
                                    dateRange: { ...prev.dateRange, to: date }
                                  }))}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        {/* Merchant Filter */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Mağaza</label>
                          <Select 
                            value={filters.merchantFilter} 
                            onValueChange={(value) => setFilters(prev => ({ ...prev, merchantFilter: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Tüm mağazalar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tüm mağazalar</SelectItem>
                              {uniqueMerchants.map(merchant => (
                                <SelectItem key={merchant} value={merchant}>
                                  {getCleanMerchantName(merchant)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Status Filter */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Durum</label>
                          <Select 
                            value={filters.statusFilter} 
                            onValueChange={(value) => setFilters(prev => ({ ...prev, statusFilter: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Tüm durumlar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tüm durumlar</SelectItem>
                              <SelectItem value="approved">Onaylı</SelectItem>
                              <SelectItem value="pending">Bekleyen</SelectItem>
                              <SelectItem value="rejected">Reddedildi</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Amount Range */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Tutar Aralığı (₺)</label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Min"
                              type="number"
                              value={filters.minAmount}
                              onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                            />
                            <Input
                              placeholder="Max"
                              type="number"
                              value={filters.maxAmount}
                              onChange={(e) => setFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Results */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {receiptsLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                          <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                          <div className="flex-1">
                            <div className="h-4 w-3/4 bg-muted rounded mb-1 animate-pulse" />
                            <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                          </div>
                          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                        </div>
                      ))
                    ) : paginatedReceipts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>Hiç fiş bulunamadı</p>
                        <p className="text-xs mt-2">Fiş yükleyerek geçmiş oluşturmaya başlayın!</p>
                      </div>
                    ) : (
                      <>
                        {paginatedReceipts.map((receipt) => (
                          <div key={receipt.id} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/10">
                            <Store className="h-4 w-4 text-primary" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-sm truncate">
                                  {getCleanMerchantName(receipt.merchant_brand || receipt.merchant)}
                                </p>
                                {getStatusBadge(receipt.status)}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatTRY(receipt.total)} • {new Date(receipt.purchase_date).toLocaleDateString('tr-TR')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                +{receipt.points}
                              </Badge>
                              {receipt.image_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewImage(receipt)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {hasMorePages && (
                          <div className="text-center pt-4">
                            <Button variant="outline" onClick={loadMore}>
                              Daha Fazla Göster
                            </Button>
                          </div>
                        )}
                        
                        {filteredReceipts.length > ITEMS_PER_PAGE && (
                          <p className="text-xs text-center text-muted-foreground pt-2">
                            {paginatedReceipts.length} / {filteredReceipts.length} fiş gösteriliyor
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Logout Section */}
          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={() => {
                  logout();
                  navigate('/auth');
                }}
                variant="destructive"
                className="w-full flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Çıkış Yap
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Image Modal */}
      {imageModalData && (
        <ReceiptImageModal
          isOpen={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          imageUrl={imageModalData.imageUrl}
          fileName={imageModalData.fileName}
          merchant={imageModalData.merchant}
          merchantBrand={imageModalData.merchantBrand}
          purchaseDate={imageModalData.purchaseDate}
          receiptId={imageModalData.receiptId}
          receiptUniqueNo={imageModalData.receiptUniqueNo}
          fisNo={imageModalData.fisNo}
          barcodeNumbers={imageModalData.barcodeNumbers}
        />
      )}
    </div>
  );
};

export default Profile;
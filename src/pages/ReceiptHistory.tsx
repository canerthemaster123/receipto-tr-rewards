import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/enhanced-button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { useReceiptData } from '../hooks/useReceiptData';
import { ReceiptImageModal } from '../components/ReceiptImageModal';
import { normalizeMerchant, getCleanMerchantName } from '../utils/merchantNormalization';
import { formatTRY } from '../utils/currency';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Receipt, 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  Store,
  Coins,
  Eye,
  Download,
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  X,
  SlidersHorizontal,
  ChevronDown,
  Loader2
} from 'lucide-react';

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

const ReceiptHistory: React.FC = () => {
  const { receipts, loading, stats } = useReceiptData();
  const { t } = useTranslation();
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
  } | null>(null);

  const [filters, setFilters] = useState<AdvancedFilters>({
    dateRange: {},
    merchantFilter: '',
    statusFilter: '',
    minAmount: '',
    maxAmount: ''
  });

  // Get unique merchants for filter dropdown
  const uniqueMerchants = useMemo(() => {
    const merchantSet = new Set<string>();
    receipts.forEach(receipt => {
      const normalizedMerchant = normalizeMerchant(receipt.merchant);
      merchantSet.add(normalizedMerchant);
    });
    return Array.from(merchantSet).sort();
  }, [receipts]);

  // Advanced filtering logic
  const filteredReceipts = useMemo(() => {
    let result = receipts;

    // Text search (merchant + items)
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

    // Date range filter
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

    // Merchant filter (normalized)
    if (filters.merchantFilter) {
      result = result.filter(receipt => 
        normalizeMerchant(receipt.merchant) === filters.merchantFilter
      );
    }

    // Status filter
    if (filters.statusFilter) {
      result = result.filter(receipt => receipt.status === filters.statusFilter);
    }

    // Amount range filter
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

  // Pagination
  const paginatedReceipts = useMemo(() => {
    return filteredReceipts.slice(0, currentPage * ITEMS_PER_PAGE);
  }, [filteredReceipts, currentPage]);

  const hasMorePages = currentPage * ITEMS_PER_PAGE < filteredReceipts.length;

  const loadMore = () => {
    if (hasMorePages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

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
      fisNo: receipt.fis_no
    });
    setImageModalOpen(true);
  };

  const getStatusBadge = (status: 'approved' | 'pending' | 'rejected') => {
    switch (status) {
      case 'approved':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('status.approved')}
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            {t('status.pending')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            {t('status.rejected')}
          </Badge>
        );
    }
  };

  const getItemsArray = (items: string): string[] => {
    if (!items) return [];
    return items.split('\n').filter(item => item.trim().length > 0);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {t('history.title')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('history.description')} ({filteredReceipts.length} {filteredReceipts.length === 1 ? 'receipt' : 'receipts'})
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1">
                {[
                  searchTerm && 'search',
                  filters.dateRange.from && 'date',
                  filters.merchantFilter && 'merchant',
                  filters.statusFilter && 'status',
                  (filters.minAmount || filters.maxAmount) && 'amount'
                ].filter(Boolean).length}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.totalReceipts}</p>
                <p className="text-xs text-muted-foreground">Total Receipts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.approvedReceipts}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingReceipts}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-secondary" />
              <div>
                <p className="text-2xl font-bold text-secondary">{stats.totalEarned}</p>
                <p className="text-xs text-muted-foreground">Points Earned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search receipts by merchant or items... (e.g., 'zeytin', 'Migros')"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Advanced Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 justify-start text-left">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {filters.dateRange.from ? format(filters.dateRange.from, 'dd/MM/yyyy') : 'From'}
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
                        {filters.dateRange.to ? format(filters.dateRange.to, 'dd/MM/yyyy') : 'To'}
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
                <label className="text-sm font-medium">Merchant</label>
                <Select 
                  value={filters.merchantFilter} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, merchantFilter: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All merchants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All merchants</SelectItem>
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
                <label className="text-sm font-medium">Status</label>
                <Select 
                  value={filters.statusFilter} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, statusFilter: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount Range (₺)</label>
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
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="shadow-card">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg w-9 h-9"></div>
                      <div className="space-y-1">
                        <div className="h-5 bg-muted rounded w-32"></div>
                        <div className="h-4 bg-muted rounded w-24"></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 bg-muted rounded w-16"></div>
                    <div className="h-6 bg-muted rounded w-16"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredReceipts.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {receipts.length === 0 ? 'No Receipts Found' : 'No Search Results'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {receipts.length === 0 
                  ? 'Start uploading receipts to see them here'
                  : 'Try adjusting your search terms or filters'
                }
              </p>
              {receipts.length === 0 && (
                <Link to="/upload">
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Your First Receipt
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {paginatedReceipts.map((receipt) => {
              const itemsArray = getItemsArray(receipt.items);
              return (
                <Card key={receipt.id} className="shadow-card hover:shadow-elegant transition-all">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Receipt Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Receipt className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{getCleanMerchantName(receipt.merchant)}</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(receipt.purchase_date).toLocaleDateString('tr-TR')}
                              {receipt.purchase_time && ` at ${receipt.purchase_time}`}
                            </p>
                          </div>
                        </div>
                        
                        {itemsArray.length > 0 && (
                          <div className="ml-11">
                            <p className="text-sm text-muted-foreground">
                              <Store className="h-3 w-3 inline mr-1" />
                              {itemsArray.slice(0, 3).join(', ')}
                              {itemsArray.length > 3 && ` +${itemsArray.length - 3} more`}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Status and Amount */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                         <div className="text-right">
                           <p className="text-xl font-bold text-primary">{formatTRY(receipt.total)}</p>
                          {receipt.status === 'approved' && (
                            <p className="text-sm text-secondary">
                              <Coins className="h-3 w-3 inline mr-1" />
                              +{receipt.points} pts
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          {getStatusBadge(receipt.status)}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedReceipt(receipt)}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          {receipt.image_url && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewImage(receipt)}
                            >
                              <Download className="h-4 w-4" />
                              Image
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Load More Button */}
            {hasMorePages && (
              <Card className="shadow-card">
                <CardContent className="p-6 text-center">
                  <Button onClick={loadMore} variant="outline" className="w-full sm:w-auto">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Load More ({filteredReceipts.length - paginatedReceipts.length} remaining)
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Receipt Detail Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Receipt Details</span>
                {getStatusBadge(selectedReceipt.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedReceipt.items && (
                <div>
                  <h4 className="font-semibold mb-2">Items:</h4>
                  <div className="space-y-1">
                     {getItemsArray(selectedReceipt.items).map((item, index) => (
                       <div key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                        • {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Purchase Date:</span>
                  <span className="text-sm">{new Date(selectedReceipt.purchase_date).toLocaleDateString('tr-TR')}</span>
                </div>
                
                {selectedReceipt.purchase_time && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Purchase Time:</span>
                    <span className="text-sm">{selectedReceipt.purchase_time}</span>
                  </div>
                )}
                
                {selectedReceipt.store_address && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Store Address:</span>
                    <span className="text-sm">{selectedReceipt.store_address}</span>
                  </div>
                )}
                
                {selectedReceipt.payment_method && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Payment Method:</span>
                    <span className="text-sm font-mono">{selectedReceipt.payment_method}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {getStatusBadge(selectedReceipt.status)}
                </div>
                
                {selectedReceipt.status === 'approved' && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Points Earned:</span>
                    <span className="text-sm font-medium text-secondary">+{selectedReceipt.points} pts</span>
                  </div>
                )}
                
                 <div className="flex justify-between items-center font-semibold">
                   <span>Total:</span>
                   <span>{formatTRY(selectedReceipt.total)}</span>
                 </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setSelectedReceipt(null)}
                >
                  Close
                </Button>
                {selectedReceipt.image_url && (
                  <Button 
                    variant="default" 
                    className="flex-1"
                    onClick={() => handleViewImage(selectedReceipt)}
                  >
                    View Image
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Image Modal */}
      {imageModalData && (
        <ReceiptImageModal
          isOpen={imageModalOpen}
          onClose={() => {
            setImageModalOpen(false);
            setImageModalData(null);
          }}
          imageUrl={imageModalData.imageUrl}
          fileName={imageModalData.fileName}
          merchant={imageModalData.merchant}
          merchantBrand={imageModalData.merchantBrand}
          purchaseDate={imageModalData.purchaseDate}
          receiptId={imageModalData.receiptId}
          receiptUniqueNo={imageModalData.receiptUniqueNo}
          fisNo={imageModalData.fisNo}
        />
      )}
    </div>
  );
};

export default ReceiptHistory;
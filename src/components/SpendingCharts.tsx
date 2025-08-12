import React, { useMemo, useEffect, useState } from 'react';
import { useReceiptData } from '../hooks/useReceiptData';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Calendar, Loader2 } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import { formatTRY, formatTRYCompact } from '../utils/currency';

interface ChartData {
  period: string;
  amount: number;
  count: number;
}

export const SpendingCharts: React.FC = () => {
  const { receipts, loading } = useReceiptData();
  const { t } = useTranslation();
  const [isCalculating, setIsCalculating] = useState(false);
  const [timeframe, setTimeframe] = useState('weekly');

  // Filter approved receipts only and handle undefined/null values
  const approvedReceipts = useMemo(() => {
    if (!receipts || !Array.isArray(receipts)) return [];
    const filtered = receipts.filter(r => 
      r && 
      r.status === 'approved' && 
      r.purchase_date && 
      r.total !== undefined && 
      r.total !== null &&
      !isNaN(parseFloat(r.total.toString()))
    );
    console.log(`Charts updated with ${filtered.length} approved receipts`);
    return filtered;
  }, [receipts]);

  // Generate weekly data (last 8 weeks) with proper error handling
  const getWeeklyData = (): ChartData[] => {
    if (!approvedReceipts.length) return [];
    
    const now = new Date();
    const weeklyData: ChartData[] = [];

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekReceipts = approvedReceipts.filter(r => {
        try {
          const receiptDate = new Date(r.purchase_date);
          return !isNaN(receiptDate.getTime()) && receiptDate >= weekStart && receiptDate <= weekEnd;
        } catch {
          return false;
        }
      });

      const totalAmount = weekReceipts.reduce((sum, r) => {
        try {
          const amount = parseFloat(r.total.toString());
          return sum + (isNaN(amount) ? 0 : amount);
        } catch {
          return sum;
        }
      }, 0);

      weeklyData.push({
        period: t('charts.week', { number: 8 - i }),
        amount: Math.round(totalAmount * 100) / 100, // Round to 2 decimal places
        count: weekReceipts.length
      });
    }

    return weeklyData;
  };

  // Generate monthly data (last 12 months) with proper error handling
  const getMonthlyData = (): ChartData[] => {
    if (!approvedReceipts.length) return [];
    
    const now = new Date();
    const monthlyData: ChartData[] = [];

    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthReceipts = approvedReceipts.filter(r => {
        try {
          const receiptDate = new Date(r.purchase_date);
          return !isNaN(receiptDate.getTime()) && receiptDate >= monthStart && receiptDate <= monthEnd;
        } catch {
          return false;
        }
      });

      const totalAmount = monthReceipts.reduce((sum, r) => {
        try {
          const amount = parseFloat(r.total.toString());
          return sum + (isNaN(amount) ? 0 : amount);
        } catch {
          return sum;
        }
      }, 0);

      monthlyData.push({
        period: monthDate.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }),
        amount: Math.round(totalAmount * 100) / 100, // Round to 2 decimal places
        count: monthReceipts.length
      });
    }

    return monthlyData;
  };

  // Memoize chart data calculations for better performance
  const weeklyData = useMemo(() => {
    setIsCalculating(true);
    const data = getWeeklyData();
    setIsCalculating(false);
    return data;
  }, [approvedReceipts, t]);

  const monthlyData = useMemo(() => {
    return getMonthlyData();
  }, [approvedReceipts, t]);

  // Set up realtime updates effect
  useEffect(() => {
    if (!loading && receipts.length > 0) {
      // Charts will automatically update due to useMemo dependencies
      console.log('Charts updated with', approvedReceipts.length, 'approved receipts');
    }
  }, [receipts, loading, approvedReceipts.length]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length && payload[0]?.payload) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-primary">
            {formatTRY(data.amount || 0)}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.count || 0} {data.count === 1 ? 'receipt' : 'receipts'}
          </p>
        </div>
      );
    }
    return null;
  };

  const totalWeeklySpend = weeklyData.reduce((sum, week) => sum + (week.amount || 0), 0);
  const totalMonthlySpend = monthlyData.reduce((sum, month) => sum + (month.amount || 0), 0);

  // Show loading skeleton while data is being fetched
  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="spending-chart">
      {/* Timeframe Selectors */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Spending Analysis
            </div>
            <div className="flex gap-2 flex-wrap">
              {['daily', 'weekly', 'monthly', 'yearly', 'all'].map((tf) => (
                <Button
                  key={tf}
                  size="sm"
                  variant={timeframe === tf ? 'default' : 'outline'}
                  onClick={() => setTimeframe(tf)}
                  data-testid={`timeframe-${tf}`}
                  className="text-xs"
                >
                  {tf.charAt(0).toUpperCase() + tf.slice(1)}
                </Button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeframe === 'weekly' && (
            <div className="h-64">
              {isCalculating ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {weeklyData.some(d => d.amount > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis 
                          dataKey="period" 
                          fontSize={12}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                         <YAxis 
                           fontSize={12}
                           tick={{ fill: 'hsl(var(--muted-foreground))' }}
                           tickFormatter={(value) => formatTRYCompact(value)}
                         />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar 
                          dataKey="amount" 
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>{t('charts.noDataAvailable')}</p>
                        <p className="text-xs mt-2">
                          {approvedReceipts.length === 0 
                            ? "Upload and approve receipts to see weekly spending trends"
                            : "No spending data in the last 8 weeks"
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {timeframe === 'monthly' && (
            <div className="h-64">
              {monthlyData.some(d => d.amount > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="period" 
                      fontSize={12}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                     <YAxis 
                       fontSize={12}
                       tick={{ fill: 'hsl(var(--muted-foreground))' }}
                       tickFormatter={(value) => formatTRYCompact(value)}
                     />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="hsl(var(--secondary))"
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--secondary))', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>{t('charts.noDataAvailable')}</p>
                    <p className="text-xs mt-2">
                      {approvedReceipts.length === 0 
                        ? "Upload and approve receipts to see monthly spending trends"
                        : "No spending data in the last 12 months"
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {(timeframe === 'daily' || timeframe === 'yearly' || timeframe === 'all') && (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Timeframe "{timeframe}" view coming soon</p>
                <p className="text-xs mt-2">Currently showing weekly and monthly views</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Keep the original charts for reference but hide them */}
      <div className="hidden">
      {/* Weekly Spending Chart */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t('charts.weeklySpend')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('charts.last8Weeks')} • {t('charts.totalSpent', { amount: totalWeeklySpend.toFixed(0) })}
          </p>
        </CardHeader>
        <CardContent>
          {isCalculating ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="h-64">
              {weeklyData.some(d => d.amount > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="period" 
                      fontSize={12}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                     <YAxis 
                       fontSize={12}
                       tick={{ fill: 'hsl(var(--muted-foreground))' }}
                       tickFormatter={(value) => formatTRYCompact(value)}
                     />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="amount" 
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>{t('charts.noDataAvailable')}</p>
                    <p className="text-xs mt-2">
                      {approvedReceipts.length === 0 
                        ? "Upload and approve receipts to see weekly spending trends"
                        : "No spending data in the last 8 weeks"
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Spending Chart */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-secondary" />
            {t('charts.monthlySpend')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('charts.last12Months')} • {t('charts.totalSpent', { amount: totalMonthlySpend.toFixed(0) })}
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {monthlyData.some(d => d.amount > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="period" 
                    fontSize={12}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                   <YAxis 
                     fontSize={12}
                     tick={{ fill: 'hsl(var(--muted-foreground))' }}
                     tickFormatter={(value) => formatTRYCompact(value)}
                   />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="hsl(var(--secondary))"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--secondary))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>{t('charts.noDataAvailable')}</p>
                  <p className="text-xs mt-2">
                    {approvedReceipts.length === 0 
                      ? "Upload and approve receipts to see monthly spending trends"
                      : "No spending data in the last 12 months"
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};
import React from 'react';
import { useReceiptData } from '../hooks/useReceiptData';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Calendar } from 'lucide-react';

interface ChartData {
  period: string;
  amount: number;
  count: number;
}

export const SpendingCharts: React.FC = () => {
  const { receipts } = useReceiptData();
  const { t } = useTranslation();

  // Filter approved receipts only
  const approvedReceipts = receipts.filter(r => r.status === 'approved');

  // Generate weekly data (last 8 weeks)
  const getWeeklyData = (): ChartData[] => {
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
        const receiptDate = new Date(r.purchase_date);
        return receiptDate >= weekStart && receiptDate <= weekEnd;
      });

      const totalAmount = weekReceipts.reduce((sum, r) => sum + parseFloat(r.total.toString()), 0);

      weeklyData.push({
        period: t('charts.week', { number: 8 - i }),
        amount: totalAmount,
        count: weekReceipts.length
      });
    }

    return weeklyData;
  };

  // Generate monthly data (last 12 months)
  const getMonthlyData = (): ChartData[] => {
    const now = new Date();
    const monthlyData: ChartData[] = [];

    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthReceipts = approvedReceipts.filter(r => {
        const receiptDate = new Date(r.purchase_date);
        return receiptDate >= monthStart && receiptDate <= monthEnd;
      });

      const totalAmount = monthReceipts.reduce((sum, r) => sum + parseFloat(r.total.toString()), 0);

      monthlyData.push({
        period: monthDate.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }),
        amount: totalAmount,
        count: monthReceipts.length
      });
    }

    return monthlyData;
  };

  const weeklyData = getWeeklyData();
  const monthlyData = getMonthlyData();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-primary">
            {formatCurrency(data.amount)}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.count} receipts
          </p>
        </div>
      );
    }
    return null;
  };

  const totalWeeklySpend = weeklyData.reduce((sum, week) => sum + week.amount, 0);
  const totalMonthlySpend = monthlyData.reduce((sum, month) => sum + month.amount, 0);

  return (
    <div className="space-y-6">
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
          <div className="h-64">
            {weeklyData.some(d => d.amount > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="period" 
                    fontSize={12}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    fontSize={12}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `₺${value}`}
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
                </div>
              </div>
            )}
          </div>
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
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="period" 
                    fontSize={12}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    fontSize={12}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `₺${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="hsl(var(--secondary))"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--secondary))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>{t('charts.noDataAvailable')}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
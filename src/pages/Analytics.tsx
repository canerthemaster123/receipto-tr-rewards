import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  fetchAnalyticsReport, 
  getAvailableChainGroups, 
  triggerWeeklyRollups,
  type AnalyticsReport 
} from '@/lib/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, RefreshCw, TrendingUp, TrendingDown, Users, ShoppingCart, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function Analytics() {
  const { user } = useAuth();
  const { userRole, isLoading: roleLoading } = useUserRole();
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [chainGroups, setChainGroups] = useState<string[]>([]);
  const [selectedChain, setSelectedChain] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [rollupsLoading, setRollupsLoading] = useState(false);

  // Check if user is admin
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (!roleLoading && userRole !== 'admin') {
      return; // Will show access denied message
    }
    
    loadChainGroups();
  }, [userRole, roleLoading]);

  useEffect(() => {
    if (selectedChain && selectedWeek) {
      loadReport();
    }
  }, [selectedChain, selectedWeek]);

  const loadChainGroups = async () => {
    try {
      const chains = await getAvailableChainGroups();
      setChainGroups(chains);
      if (chains.length > 0 && !selectedChain) {
        setSelectedChain(chains[0]);
      }
    } catch (error) {
      console.error('Error loading chain groups:', error);
      toast.error('Failed to load chain groups');
    }
  };

  const loadReport = async () => {
    if (!selectedChain) return;
    
    setLoading(true);
    try {
      const reportData = await fetchAnalyticsReport(selectedChain, selectedWeek || undefined);
      setReport(reportData);
      if (!reportData) {
        toast.error('No data available for selected period');
      }
    } catch (error) {
      console.error('Error loading report:', error);
      toast.error('Failed to load analytics report');
    } finally {
      setLoading(false);
    }
  };

  const handleRunRollups = async () => {
    setRollupsLoading(true);
    try {
      const result = await triggerWeeklyRollups();
      if (result.success) {
        toast.success('Weekly rollups completed successfully');
        if (selectedChain) {
          await loadReport(); // Refresh current report
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error running rollups:', error);
      toast.error('Failed to run weekly rollups');
    } finally {
      setRollupsLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!report) return;
    
    // Create CSV content
    const csvContent = [
      'Metric,Value',
      `Weekly Active Buyers,${report.kpis.wab}`,
      `Leakage Percentage,${report.kpis.leakage_pct.toFixed(2)}%`,
      `Winback Percentage,${report.kpis.winback_pct.toFixed(2)}%`,
      `Average Order Value,${report.kpis.aov.toFixed(2)}`,
      '',
      'Top Geographic Changes',
      'City,District,Neighborhood,Current Users,Previous Users,Change %',
      ...report.top_changes.map(change => 
        `${change.city},${change.district},${change.neighborhood},${change.current_users},${change.previous_users},${change.change_pct.toFixed(2)}%`
      )
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${report.chain_group}-${report.week_start}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Loading state
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  // Access control
  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Bu sayfaya erişim için admin yetkisi gereklidir. Lütfen yöneticinizle iletişime geçin.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">B2B Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Haftalık ve aylık trendler, rekabet analizi ve coğrafi değişiklikler
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRunRollups}
            disabled={rollupsLoading}
            variant="outline"
          >
            {rollupsLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run Rollups
          </Button>
          <Button
            onClick={handleDownloadCSV}
            disabled={!report}
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Chain Group</label>
            <Select value={selectedChain} onValueChange={setSelectedChain}>
              <SelectTrigger>
                <SelectValue placeholder="Select chain group" />
              </SelectTrigger>
              <SelectContent>
                {chainGroups.map(chain => (
                  <SelectItem key={chain} value={chain}>{chain}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Week (Optional)</label>
            <input
              type="week"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              placeholder="Current week"
            />
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading analytics data...</span>
        </div>
      )}

      {report && (
        <Tabs defaultValue="kpis" className="space-y-4">
          <TabsList>
            <TabsTrigger value="kpis">KPIs</TabsTrigger>
            <TabsTrigger value="geographic">Geographic Changes</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="kpis" className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Weekly Active Buyers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{report.kpis.wab}</div>
                  <p className="text-xs text-muted-foreground">
                    Total unique users this week
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Leakage Rate</CardTitle>
                  <TrendingDown className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{report.kpis.leakage_pct.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    Users switching to competitors
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Winback Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{report.kpis.winback_pct.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    Users returning to chain
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₺{report.kpis.aov.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    Average basket value
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Segment Stats */}
            {report.segment_stats && (
              <Card>
                <CardHeader>
                  <CardTitle>Segment Statistics</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{report.segment_stats.total_stores}</div>
                    <p className="text-sm text-muted-foreground">Total Stores</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{report.segment_stats.active_districts}</div>
                    <p className="text-sm text-muted-foreground">Active Districts</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{report.segment_stats.total_receipts}</div>
                    <p className="text-sm text-muted-foreground">Total Receipts</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="geographic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Geographic Changes</CardTitle>
                <CardDescription>
                  Neighborhoods with the most significant user count changes vs previous week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead>Current Users</TableHead>
                      <TableHead>Previous Users</TableHead>
                      <TableHead>Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.top_changes.map((change, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{change.neighborhood}</div>
                            <div className="text-sm text-muted-foreground">
                              {change.district}, {change.city}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{change.current_users}</TableCell>
                        <TableCell>{change.previous_users}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={change.change_pct > 0 ? "default" : "destructive"}
                            className="flex items-center gap-1"
                          >
                            {change.change_pct > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {change.change_pct > 0 ? '+' : ''}{change.change_pct.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
                <CardDescription>
                  Anomalies detected based on statistical analysis (z-score ≥ 3.0)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.alerts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No alerts detected for this period
                  </p>
                ) : (
                  <div className="space-y-3">
                    {report.alerts.map((alert) => (
                      <Alert key={alert.id}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="flex items-center justify-between">
                          <div>
                            <strong>{alert.geo_value}</strong> - {alert.metric_name} anomaly
                            <br />
                            <span className="text-sm">
                              Current: {alert.current_value.toFixed(2)}, 
                              Previous: {alert.previous_value.toFixed(2)}
                              (Z-score: {alert.z_score.toFixed(2)})
                            </span>
                          </div>
                          <Badge 
                            variant={
                              alert.severity === 'critical' ? 'destructive' :
                              alert.severity === 'high' ? 'secondary' : 'outline'
                            }
                          >
                            {alert.severity}
                          </Badge>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
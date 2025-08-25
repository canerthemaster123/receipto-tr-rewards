import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, RefreshCw, TrendingUp, TrendingDown, Users, ShoppingCart, AlertTriangle, Database } from 'lucide-react';
import { toast } from 'sonner';

interface InsightBundle {
  week_start: string;
  chain_group: string;
  kpis: {
    wab: number;
    aov: number;
    leakage_pct: number;
    winback_pct: number;
    net_flow: number;
  };
  top_geo_changes: Array<{
    city: string;
    district: string;
    neighborhood: string;
    metric: string;
    delta_pct: number;
    n: number;
  }>;
  top_categories: Array<any>;
  alerts: Array<{
    level: string;
    type: string;
    metric: string;
    city: string;
    district: string;
    neighborhood: string;
    delta_pct: number;
    n: number;
  }>;
}

export default function Analytics() {
  const [report, setReport] = useState<InsightBundle | null>(null);
  const [chainGroups, setChainGroups] = useState<string[]>([]);
  const [selectedChain, setSelectedChain] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [rollupsLoading, setRollupsLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

  const allowDevSeed = import.meta.env.VITE_ALLOW_DEV_SEED === 'true';

  useEffect(() => {
    loadChainGroups();
  }, []);

  useEffect(() => {
    if (selectedChain) {
      loadReport();
    }
  }, [selectedChain]);

  const loadChainGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('period_geo_merchant_week')
        .select('chain_group')
        .order('chain_group');

      if (error) throw error;

      const uniqueChains = [...new Set(data.map(item => item.chain_group))];
      setChainGroups(uniqueChains);
      
      // Default to 'Migros' if available, otherwise first available
      const defaultChain = uniqueChains.includes('Migros') ? 'Migros' : uniqueChains[0];
      if (defaultChain && !selectedChain) {
        setSelectedChain(defaultChain);
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('reports', {
        body: { chain_group: selectedChain }
      });

      if (response.error) throw response.error;

      setReport(response.data);
    } catch (error) {
      console.error('Error loading report:', error);
      toast.error('Failed to load analytics report');
      
      if (error.message?.includes('No data available')) {
        toast.info('Try seeding demo data first using the button below');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRunRollups = async () => {
    setRollupsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('run-rollups');
      
      if (response.error) throw response.error;

      toast.success('Weekly rollups completed successfully');
      if (selectedChain) {
        await loadReport(); // Refresh current report
      }
    } catch (error) {
      console.error('Error running rollups:', error);
      toast.error('Failed to run weekly rollups');
    } finally {
      setRollupsLoading(false);
    }
  };

  const handleSeedDemo = async () => {
    setSeedLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('dev-seed');
      
      if (response.error) throw response.error;

      toast.success('Demo data seeded successfully');
      await loadChainGroups(); // Refresh chain groups
      if (!selectedChain) {
        setSelectedChain('Migros'); // Default after seeding
      } else {
        await loadReport(); // Refresh current report
      }
    } catch (error) {
      console.error('Error seeding demo data:', error);
      toast.error('Failed to seed demo data');
    } finally {
      setSeedLoading(false);
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
      `Net Flow,${report.kpis.net_flow}`,
      '',
      'Top Geographic Changes',
      'City,District,Neighborhood,Metric,Delta %,Sample Size',
      ...report.top_geo_changes.map(change => 
        `${change.city},${change.district},${change.neighborhood},${change.metric},${change.delta_pct.toFixed(2)}%,${change.n}`
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

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">B2B Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Haftalık ve aylık trendler, rekabet analizi ve coğrafi değişiklikler
            </p>
          </div>
          <div className="flex gap-2">
            {allowDevSeed && (
              <Button
                onClick={handleSeedDemo}
                disabled={seedLoading}
                variant="outline"
              >
                {seedLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Seed Demo Data (Dev)
              </Button>
            )}
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
              Run Rollups Now
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
          </CardContent>
        </Card>

        {loading && (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading analytics data...</span>
          </div>
        )}

        {!loading && !report && chainGroups.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
              <p className="text-muted-foreground mb-4">
                No analytics data found. {allowDevSeed ? 'Use the "Seed Demo Data" button to generate sample data.' : 'Please contact your administrator.'}
              </p>
              {allowDevSeed && (
                <Button onClick={handleSeedDemo} disabled={seedLoading}>
                  {seedLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Database className="h-4 w-4 mr-2" />
                  )}
                  Seed Demo Data
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {report && (
          <Tabs defaultValue="kpis" className="space-y-4">
            <TabsList>
              <TabsTrigger value="kpis">KPIs</TabsTrigger>
              <TabsTrigger value="geographic">Geographic Changes</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            <TabsContent value="kpis" className="space-y-4">
              {/* Week Info */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold">Week of {report.week_start}</h3>
                    <p className="text-sm text-muted-foreground">Chain Group: {report.chain_group}</p>
                  </div>
                </CardContent>
              </Card>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Leakage Rate</CardTitle>
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{report.kpis.leakage_pct.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">
                      New user percentage
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
                      Returning user percentage
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Net Flow</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{report.kpis.net_flow}</div>
                    <p className="text-xs text-muted-foreground">
                      User acquisition balance
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="geographic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Top Geographic Changes</CardTitle>
                  <CardDescription>
                    Districts with the highest activity for {report.chain_group}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead>Metric</TableHead>
                        <TableHead>Sample Size</TableHead>
                        <TableHead>Delta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.top_geo_changes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                            No geographic changes data available
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.top_geo_changes.map((change, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{change.neighborhood}</div>
                                <div className="text-sm text-muted-foreground">
                                  {change.district}, {change.city}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{change.metric}</TableCell>
                            <TableCell>{change.n}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={change.delta_pct > 0 ? "default" : "outline"}
                                className="flex items-center gap-1"
                              >
                                {change.delta_pct > 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {change.delta_pct > 0 ? '+' : ''}{change.delta_pct.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
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
                      {report.alerts.map((alert, index) => (
                        <Alert key={index}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="flex items-center justify-between">
                            <div>
                              <strong>{alert.city}, {alert.district}</strong> - {alert.metric} anomaly
                              <br />
                              <span className="text-sm">
                                Type: {alert.type}, Delta: {alert.delta_pct.toFixed(2)}%
                                (Sample size: {alert.n})
                              </span>
                            </div>
                            <Badge 
                              variant={
                                alert.level === 'critical' ? 'destructive' :
                                alert.level === 'high' ? 'secondary' : 'outline'
                              }
                            >
                              {alert.level}
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
    </Layout>
  );
}
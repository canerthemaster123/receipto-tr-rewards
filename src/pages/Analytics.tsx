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
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [rollupsLoading, setRollupsLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  const allowDevSeed = import.meta.env.VITE_ALLOW_DEV_SEED === 'true';

  useEffect(() => {
    loadChainGroups();
  }, []);

  useEffect(() => {
    if (selectedChain) {
      loadAvailableWeeks();
    }
  }, [selectedChain]);

  useEffect(() => {
    if (selectedChain && selectedWeek) {
      loadReport();
      // Don't auto-load AI analysis anymore
    }
  }, [selectedChain, selectedWeek]);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc('has_admin');
        if (!error) setIsAdmin(Boolean(data));
      } catch (_) {
        setIsAdmin(false);
      }
    })();
  }, []);

  const loadChainGroups = async () => {
    try {
      let uniqueChains: string[] = [];

      // 1) Try rollup table first (preferred)
      const { data: pgmw, error: pgmwError } = await supabase
        .from('period_geo_merchant_week')
        .select('chain_group')
        .order('chain_group');

      if (!pgmwError && pgmw && pgmw.length > 0) {
        uniqueChains = [...new Set(pgmw.map((item: any) => item.chain_group).filter(Boolean))];
      }

      // 2) Fallback to merchant_map
      if (uniqueChains.length === 0) {
        const { data: mm, error: mmError } = await supabase
          .from('merchant_map')
          .select('chain_group')
          .eq('active', true);

        if (!mmError && mm) {
          uniqueChains = [...new Set(mm.map((i: any) => i.chain_group).filter(Boolean))].sort();
        }
      }

      // 3) Last resort: static list
      if (uniqueChains.length === 0) {
        uniqueChains = ['Migros', 'A101', 'BIM', 'SOK', 'CarrefourSA'];
      }

      setChainGroups(uniqueChains);
      // Auto-select Migros if available, otherwise first available
      const defaultChain = uniqueChains.includes('Migros') ? 'Migros' : uniqueChains[0];
      if (defaultChain && !selectedChain) {
        setSelectedChain(defaultChain);
      }
    } catch (error: any) {
      console.error('Error loading chain groups:', error);
      toast.error(`Zincir listesi yüklenemedi: ${error?.message || ''}`);
      // Graceful fallback
      const fallback = ['Migros', 'A101', 'BIM', 'SOK', 'CarrefourSA'];
      setChainGroups(fallback);
      if (!selectedChain) setSelectedChain('Migros');
    }
  };

  const loadAvailableWeeks = async () => {
    if (!selectedChain) return;
    try {
      // Generate week starts from 2025-08-04 (Mon) up to current week's Monday
      const start = new Date('2025-08-04T00:00:00Z');
      const today = new Date();

      // Find current week's Monday in UTC
      const lastMonday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const day = lastMonday.getUTCDay(); // Sun=0, Mon=1, ...
      const diffToMonday = (day + 6) % 7; // 0 if Mon, 1 if Tue, ...
      lastMonday.setUTCDate(lastMonday.getUTCDate() - diffToMonday);
      lastMonday.setUTCHours(0, 0, 0, 0);

      const weeks: string[] = [];
      const cursor = new Date(start);
      while (cursor <= lastMonday) {
        weeks.push(cursor.toISOString().slice(0, 10)); // YYYY-MM-DD
        cursor.setUTCDate(cursor.getUTCDate() + 7);
      }

      weeks.reverse(); // Most recent first
      setAvailableWeeks(weeks);

      // Auto-select most recent week if none selected or selection is out of range
      if (weeks.length > 0 && (!selectedWeek || !weeks.includes(selectedWeek))) {
        setSelectedWeek(weeks[0]);
      }
    } catch (error) {
      console.error('Error generating available weeks:', error);
      toast.error('Hafta listesi oluşturulamadı');
    }
  };

  const loadReport = async () => {
    if (!selectedChain || !selectedWeek) return;
    
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('reports', {
        body: { 
          chain_group: selectedChain,
          week_start: selectedWeek
        }
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

  const loadAIAnalysis = async () => {
    if (!selectedChain || !selectedWeek) return;
    
    setAnalysisLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('market-analysis', {
        body: { 
          chain_group: selectedChain,
          week_start: selectedWeek
        }
      });

      if (response.error) throw response.error;

      setAiAnalysis(response.data.analysis || 'Analiz oluşturulamadı.');
    } catch (error) {
      console.error('Error loading AI analysis:', error);
      toast.error('AI analizi yüklenirken hata oluştu');
      setAiAnalysis('AI analizi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
    } finally {
      setAnalysisLoading(false);
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
        await loadAvailableWeeks(); // Refresh weeks
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
        await loadAvailableWeeks();
        await loadReport(); // Refresh current report
      }
    } catch (error) {
      console.error('Error seeding demo data:', error);
      toast.error('Failed to seed demo data');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleApproveAllPending = async () => {
    if (!selectedChain) return;
    
    setApproveLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.rpc('approve_all_pending_for_merchant', {
        p_merchant: selectedChain
      });

      if (response.error) throw response.error;

      const result = response.data;
      if (result.success) {
        toast.success(`${result.receipts_approved} fiş onaylandı, ${result.total_points_awarded} puan verildi`);
        await loadReport(); // Refresh data
      } else {
        if (result.error === 'no_pending_receipts') {
          toast.info(`${selectedChain} için bekleyen fiş bulunamadı`);
        } else {
          toast.error(`Onaylama hatası: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('Error approving pending receipts:', error);
      toast.error('Toplu onaylama işlemi başarısız');
    } finally {
      setApproveLoading(false);
    }
  };

  const handleResetAndSeed = async () => {
    setResetLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const resetRes = await supabase.functions.invoke('reset-receipts');
      if (resetRes.error) throw resetRes.error;

      const seedRes = await supabase.functions.invoke('dev-seed');
      if (seedRes.error) throw seedRes.error;

      toast.success('Veriler sıfırlandı ve test verisi eklendi');
      await loadChainGroups();
      if (selectedChain) {
        await loadAvailableWeeks();
        await loadReport();
      }
    } catch (error) {
      console.error('Reset+Seed error:', error);
      toast.error('Sıfırlama/seed işlemi başarısız');
    } finally {
      setResetLoading(false);
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
            {isAdmin && (
              <>
                <Button
                  onClick={handleApproveAllPending}
                  disabled={approveLoading || !selectedChain}
                  variant="outline"
                  className="border-green-500 text-green-600 hover:bg-green-50"
                >
                  {approveLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Users className="h-4 w-4 mr-2" />
                  )}
                  {selectedChain} Onaylarını Toplu Yap
                </Button>
                <Button
                  onClick={loadAIAnalysis}
                  disabled={analysisLoading || !selectedChain}
                  variant="default"
                  className="bg-primary hover:bg-primary/90"
                >
                  {analysisLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mr-2" />
                  )}
                  Rapor Oluştur
                </Button>
              </>
            )}
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
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Market seçin" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border z-50">
                  {chainGroups.map(chain => (
                    <SelectItem key={chain} value={chain} className="hover:bg-accent">
                      {chain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Hafta Seçin</label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek} disabled={!selectedChain || availableWeeks.length === 0}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Hafta seçin" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border z-50">
                  {availableWeeks.map(week => (
                    <SelectItem key={week} value={week} className="hover:bg-accent">
                      {new Date(week).toLocaleDateString('tr-TR')} haftası
                    </SelectItem>
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
              <TabsTrigger value="ai-analysis">AI Analizi</TabsTrigger>
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

            <TabsContent value="ai-analysis" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI Market Analizi</CardTitle>
                  <CardDescription>
                    {selectedChain} marketi için AI destekli rekabet analizi ve öneriler
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analysisLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                      <span>AI analizi hazırlanıyor...</span>
                    </div>
                  ) : aiAnalysis ? (
                    <div className="prose max-w-none">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/50 p-4 rounded-lg">
                        {aiAnalysis}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">
                        AI analizi henüz oluşturulmadı.
                      </p>
                      {isAdmin && (
                        <Button onClick={loadAIAnalysis} disabled={!selectedChain}>
                          Rapor Oluştur
                        </Button>
                      )}
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
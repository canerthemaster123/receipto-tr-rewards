import { supabase } from '@/integrations/supabase/client';

export interface AnalyticsKPIs {
  wab: number; // Weekly Active Buyers
  leakage_pct: number; // Percentage of users who switched to competitors  
  winback_pct: number; // Percentage of users who returned
  aov: number; // Average Order Value
}

export interface GeoChange {
  city: string;
  district: string;
  neighborhood: string;
  current_users: number;
  previous_users: number;
  change_pct: number;
}

export interface Alert {
  id: string;
  alert_type: string;
  geo_value: string;
  metric_name: string;
  current_value: number;
  previous_value: number;
  z_score: number;
  severity: string;
  week_start: string;
}

export interface AnalyticsReport {
  chain_group: string;
  week_start: string;
  kpis: AnalyticsKPIs;
  top_changes: GeoChange[];
  alerts: Alert[];
  segment_stats?: {
    total_stores: number;
    active_districts: number;
    total_receipts: number;
  };
}

/**
 * Fetch analytics report for a specific chain group and week
 */
export async function fetchAnalyticsReport(
  chainGroup: string,
  weekStart?: string
): Promise<AnalyticsReport | null> {
  try {
    // Default to current week if not specified
    const targetWeek = weekStart || getISOWeek(new Date());
    
    // Fetch KPIs from period_user_merchant_week
    const { data: userWeekData, error: userWeekError } = await supabase
      .from('period_user_merchant_week')
      .select('*')
      .eq('chain_group', chainGroup)
      .eq('week_start', targetWeek);

    if (userWeekError) {
      console.error('Error fetching user week data:', userWeekError);
      return null;
    }

    // Fetch geo data from period_geo_merchant_week
    const { data: geoWeekData, error: geoWeekError } = await supabase
      .from('period_geo_merchant_week')
      .select('*')
      .eq('chain_group', chainGroup)
      .eq('week_start', targetWeek)
      .order('unique_users', { ascending: false })
      .limit(10);

    if (geoWeekError) {
      console.error('Error fetching geo week data:', geoWeekError);
      return null;
    }

    // Fetch previous week data for comparison
    const previousWeek = getPreviousWeek(targetWeek);
    const { data: prevGeoData } = await supabase
      .from('period_geo_merchant_week')
      .select('*')
      .eq('chain_group', chainGroup)
      .eq('week_start', previousWeek);

    // Fetch alerts for this week
    const { data: alertsData, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('chain_group', chainGroup)
      .eq('week_start', targetWeek)
      .order('z_score', { ascending: false });

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError);
    }

    // Calculate KPIs
    const kpis = calculateKPIs(userWeekData || []);
    
    // Calculate geo changes
    const topChanges = calculateGeoChanges(geoWeekData || [], prevGeoData || []);
    
    // Format alerts
    const alerts: Alert[] = (alertsData || []).map(alert => ({
      id: alert.id,
      alert_type: alert.alert_type,
      geo_value: alert.geo_value,
      metric_name: alert.metric_name,
      current_value: alert.current_value,
      previous_value: alert.previous_value,
      z_score: alert.z_score,
      severity: alert.severity,
      week_start: alert.week_start
    }));

    // Calculate segment stats
    const segmentStats = {
      total_stores: new Set((geoWeekData || []).map(d => `${d.city}-${d.district}-${d.neighborhood}`)).size,
      active_districts: new Set((geoWeekData || []).map(d => `${d.city}-${d.district}`)).size,
      total_receipts: (geoWeekData || []).reduce((sum, d) => sum + (d.receipt_count || 0), 0)
    };

    return {
      chain_group: chainGroup,
      week_start: targetWeek,
      kpis,
      top_changes: topChanges,
      alerts,
      segment_stats: segmentStats
    };

  } catch (error) {
    console.error('Error fetching analytics report:', error);
    return null;
  }
}

function calculateKPIs(userWeekData: any[]): AnalyticsKPIs {
  if (!userWeekData.length) {
    return { wab: 0, leakage_pct: 0, winback_pct: 0, aov: 0 };
  }

  const totalUsers = userWeekData.length;
  const firstTimeUsers = userWeekData.filter(u => u.first_visit_week).length;
  const returningUsers = userWeekData.filter(u => !u.first_visit_week && !u.last_visit_week).length;
  const leavingUsers = userWeekData.filter(u => u.last_visit_week).length;
  
  const totalSpend = userWeekData.reduce((sum, u) => sum + (u.total_spend || 0), 0);
  const totalReceipts = userWeekData.reduce((sum, u) => sum + (u.receipt_count || 0), 0);

  return {
    wab: totalUsers,
    leakage_pct: totalUsers > 0 ? (leavingUsers / totalUsers) * 100 : 0,
    winback_pct: totalUsers > 0 ? (firstTimeUsers / totalUsers) * 100 : 0,
    aov: totalReceipts > 0 ? totalSpend / totalReceipts : 0
  };
}

function calculateGeoChanges(currentData: any[], previousData: any[]): GeoChange[] {
  const changes: GeoChange[] = [];
  
  // Create lookup map for previous week data
  const prevMap = new Map();
  previousData.forEach(d => {
    const key = `${d.city}-${d.district}-${d.neighborhood}`;
    prevMap.set(key, d);
  });

  // Calculate changes for current week locations
  currentData.forEach(current => {
    const key = `${current.city}-${current.district}-${current.neighborhood}`;
    const previous = prevMap.get(key);
    
    if (previous) {
      const currentUsers = current.unique_users || 0;
      const previousUsers = previous.unique_users || 0;
      const changePct = previousUsers > 0 ? 
        ((currentUsers - previousUsers) / previousUsers) * 100 : 
        (currentUsers > 0 ? 100 : 0);

      if (Math.abs(changePct) >= 10) { // Only include significant changes
        changes.push({
          city: current.city,
          district: current.district,
          neighborhood: current.neighborhood,
          current_users: currentUsers,
          previous_users: previousUsers,
          change_pct: changePct
        });
      }
    }
  });

  // Sort by absolute change percentage
  return changes
    .sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))
    .slice(0, 10);
}

function getISOWeek(date: Date): string {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

function getPreviousWeek(weekString: string): string {
  const [year, week] = weekString.split('-W');
  const weekNum = parseInt(week);
  
  if (weekNum > 1) {
    return `${year}-W${(weekNum - 1).toString().padStart(2, '0')}`;
  } else {
    // Handle year transition
    const prevYear = parseInt(year) - 1;
    return `${prevYear}-W52`; // Approximate - could be 53 in some years
  }
}

/**
 * Get available chain groups for analytics
 */
export async function getAvailableChainGroups(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('period_geo_merchant_week')
      .select('chain_group')
      .not('chain_group', 'is', null);

    if (error) {
      console.error('Error fetching chain groups:', error);
      return [];
    }

    const uniqueChains = [...new Set(data.map(d => d.chain_group))];
    return uniqueChains.sort();
  } catch (error) {
    console.error('Error fetching chain groups:', error);
    return [];
  }
}

/**
 * Trigger weekly rollups manually (admin only)
 */
export async function triggerWeeklyRollups(): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('fn_run_weekly_rollups');
    
    if (error) {
      console.error('Error running weekly rollups:', error);
      return { success: false, message: error.message };
    }
    
    return { success: true, message: 'Weekly rollups completed successfully' };
  } catch (error) {
    console.error('Error triggering rollups:', error);
    return { success: false, message: 'Failed to trigger rollups' };
  }
}
'use client';

import React from 'react';
import { 
  WeeklyProductionPlan, 
  DailyProductionLog, 
  WeeklySummary,
  getMonthName,
  getMonthShortName
} from '@/types';
import { formatKg, formatPercent, deduplicatePlansList } from '@/lib/storage';
import { WeeklyLineChart } from './WeeklyLineChart';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Target, 
  Scale, 
  Flame, 
  ChevronRight, 
  Filter, 
  ArrowUpRight,
  AlertCircle
} from '@/components/icons';

interface SummaryDashboardProps {
  plans: WeeklyProductionPlan[];
  selectedWeekFilter: string; // 'all' or plan.id or 'month-M-YYYY'
  onSelectWeekFilter: (val: string) => void;
  activePlan: WeeklyProductionPlan;
  logs: DailyProductionLog[];
  summary: WeeklySummary;
  onNavigateToInput: () => void;
  onNavigateToPlanning: () => void;
}

export const SummaryDashboard: React.FC<SummaryDashboardProps> = ({
  plans,
  selectedWeekFilter,
  onSelectWeekFilter,
  activePlan,
  logs,
  summary,
  onNavigateToInput,
  onNavigateToPlanning,
}) => {
  // Pastikan rencana tidak mengalami duplikasi per (tahun, bulan, minggu)
  const dedupedPlans = React.useMemo(() => deduplicatePlansList(plans), [plans]);

  const isAllWeeks = selectedWeekFilter === 'all';
  const currentPlan = isAllWeeks ? activePlan : (dedupedPlans.find(p => p.id === selectedWeekFilter) || activePlan);

  // Available months extracted from plans
  const availableMonths = React.useMemo(() => {
    const map = new Map<string, { month: number; year: number; label: string }>();
    dedupedPlans.forEach(p => {
      const m = p.month || Number(p.start_date.split('-')[1]) || 10;
      const y = p.year || 2026;
      const key = `${m}-${y}`;
      if (!map.has(key)) {
        map.set(key, {
          month: m,
          year: y,
          label: `${getMonthName(m)} ${y}`,
        });
      }
    });
    return Array.from(map.entries()).sort((a, b) => {
      if (b[1].year !== a[1].year) return b[1].year - a[1].year;
      return b[1].month - a[1].month;
    });
  }, [dedupedPlans]);

  // Determine current selected month key
  const currentMonthKey = React.useMemo(() => {
    if (selectedWeekFilter === 'all') return 'all';
    if (selectedWeekFilter.startsWith('month-')) {
      const parts = selectedWeekFilter.split('-');
      return `${parts[1]}-${parts[2]}`;
    }
    const found = dedupedPlans.find(p => p.id === selectedWeekFilter);
    if (found) {
      const m = found.month || Number(found.start_date.split('-')[1]) || 10;
      return `${m}-${found.year || 2026}`;
    }
    return 'all';
  }, [selectedWeekFilter, dedupedPlans]);

  // Plans filtered by current month key (when not 'all')
  const filteredMonthPlans = React.useMemo(() => {
    if (currentMonthKey === 'all') return dedupedPlans;
    const [mStr, yStr] = currentMonthKey.split('-');
    const m = Number(mStr);
    const y = Number(yStr);
    return dedupedPlans
      .filter(p => {
        const pMonth = p.month || Number(p.start_date.split('-')[1]) || 10;
        return pMonth === m && (p.year || 2026) === y;
      })
      .sort((a, b) => a.week_number - b.week_number);
  }, [dedupedPlans, currentMonthKey]);

  const handleMonthChange = (monthKey: string) => {
    if (monthKey === 'all') {
      onSelectWeekFilter('all');
    } else {
      // Set to all weeks of this month
      onSelectWeekFilter(`month-${monthKey}`);
    }
  };

  const selectedMonthInfo = availableMonths.find(([k]) => k === currentMonthKey)?.[1];

  // Title for hero card
  let periodTitle = 'Pencapaian Akumulasi Semua Week';
  if (selectedWeekFilter.startsWith('month-')) {
    const parts = selectedWeekFilter.split('-');
    const m = Number(parts[1]);
    const y = Number(parts[2]);
    periodTitle = `Pencapaian Akumulasi Bulan ${getMonthName(m)} ${y}`;
  } else if (!isAllWeeks) {
    const m = currentPlan.month || Number(currentPlan.start_date.split('-')[1]) || 10;
    periodTitle = `Pencapaian Minggu Ke-${currentPlan.week_number} (${getMonthShortName(m)} ${currentPlan.year})`;
  }

  // Scoped plans for logs and today's stats
  const scopedPlanIds = React.useMemo(() => {
    if (currentMonthKey === 'all' && selectedWeekFilter === 'all') {
      return new Set(plans.map(p => p.id));
    }
    if (selectedWeekFilter.startsWith('month-') || currentMonthKey !== 'all') {
      if (!isAllWeeks && !selectedWeekFilter.startsWith('month-')) {
        return new Set([selectedWeekFilter]);
      }
      return new Set(filteredMonthPlans.map(p => p.id));
    }
    return new Set(plans.map(p => p.id));
  }, [currentMonthKey, selectedWeekFilter, plans, filteredMonthPlans, isAllWeeks]);

  // Today's stats: scoped to the selected month/plan
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = React.useMemo(() => {
    return logs.filter(l => l.date === todayStr && scopedPlanIds.has(l.plan_id));
  }, [logs, todayStr, scopedPlanIds]);
  const todayActualKg = React.useMemo(() => {
    return todayLogs.reduce((acc, curr) => acc + curr.actual_kg, 0);
  }, [todayLogs]);

  // Status badge config
  const getStatusBadge = () => {
    if (summary.status === 'on_track') {
      return {
        bg: 'bg-success-subtle text-success border-success-border',
        icon: CheckCircle2,
        label: 'On Track',
      };
    }
    if (summary.status === 'warning') {
      return {
        bg: 'bg-warning-subtle text-warning border-warning-border',
        icon: AlertTriangle,
        label: 'Perlu Perhatian',
      };
    }
    return {
      bg: 'bg-primary/10 text-link border-primary/30',
      icon: Flame,
      label: 'Tertinggal',
    };
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  // Aggregate targets across all or selected plans for SKU breakdown
  const targetSkuList = React.useMemo(() => {
    let plansToConsider = dedupedPlans;
    if (selectedWeekFilter.startsWith('month-')) {
      const parts = selectedWeekFilter.split('-');
      const m = Number(parts[1]);
      const y = Number(parts[2]);
      plansToConsider = dedupedPlans.filter(p => {
        const pMonth = p.month || Number(p.start_date.split('-')[1]) || 10;
        return pMonth === m && (p.year || 2026) === y;
      });
    } else if (!isAllWeeks) {
      plansToConsider = [currentPlan];
    }

    const map = new Map<string, {
      sku_id: string;
      sku_code: string;
      sku_name: string;
      category: string;
      target_kg: number;
      isUnplanned: boolean;
    }>();

    plansToConsider.forEach(p => {
      (p.targets || []).forEach(t => {
        if (!map.has(t.sku_id)) {
          map.set(t.sku_id, {
            sku_id: t.sku_id,
            sku_code: t.sku_code,
            sku_name: t.sku_name,
            category: t.category,
            target_kg: t.target_kg,
            isUnplanned: false,
          });
        } else {
          const existing = map.get(t.sku_id)!;
          existing.target_kg += t.target_kg;
        }
      });
    });

    const relevantPlanIds = new Set(plansToConsider.map(p => p.id));
    const filteredLogs = logs.filter(l => relevantPlanIds.has(l.plan_id));

    // Tambahkan produk yang diinput oleh tim produksi namun tidak terdapat dalam target rencana
    filteredLogs.forEach(l => {
      if (!map.has(l.sku_id)) {
        map.set(l.sku_id, {
          sku_id: l.sku_id,
          sku_code: l.sku_code,
          sku_name: l.sku_name,
          category: 'Non-Plan',
          target_kg: 0,
          isUnplanned: true,
        });
      }
    });

    return Array.from(map.values()).map(target => {
      const skuLogs = filteredLogs.filter(l => l.sku_id === target.sku_id);
      const actual = skuLogs.reduce((acc, l) => acc + l.actual_kg, 0);
      const percent = target.target_kg > 0 ? (actual / target.target_kg) * 100 : 0;
      const remaining = Math.max(0, target.target_kg - actual);
      return {
        ...target,
        actual_kg: Math.round(actual * 10) / 10,
        percent: Math.round(percent * 10) / 10,
        remaining_kg: Math.round(remaining * 10) / 10,
      };
    });
  }, [isAllWeeks, dedupedPlans, currentPlan, logs, selectedWeekFilter]);

  const [skuTab, setSkuTab] = React.useState<'all' | 'unachieved' | 'achieved'>('all');

  const unachievedSkuList = React.useMemo(() => {
    return targetSkuList.filter(item => !item.isUnplanned && item.percent < 100);
  }, [targetSkuList]);

  const achievedSkuList = React.useMemo(() => {
    return targetSkuList.filter(item => !item.isUnplanned && item.percent >= 100);
  }, [targetSkuList]);

  const displayedSkuList = React.useMemo(() => {
    if (skuTab === 'unachieved') return unachievedSkuList;
    if (skuTab === 'achieved') return achievedSkuList;
    return targetSkuList;
  }, [skuTab, unachievedSkuList, achievedSkuList, targetSkuList]);

  return (
    <div className="space-y-4 pb-20">
      {/* Two-Tier Filter Bar: Bulan Kebutuhan + Minggu */}
      <div className="bg-card border border-border rounded-2xl p-3.5 shadow-card flex flex-col @min-[640px]:flex-row @min-[640px]:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-foreground">
          <Filter className="w-4 h-4 text-link" />
          <span>Filter Periode Produksi:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tier 1: Bulan Kebutuhan */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">Bulan:</span>
            <select
              value={currentMonthKey}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="bg-background border border-input focus-visible:border-ring text-foreground rounded-xl px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
            >
              <option value="all">Semua Bulan</option>
              {availableMonths.map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tier 2: Minggu Produksi (Week 1 - 5) */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">Pekan:</span>
            <select
              value={selectedWeekFilter}
              onChange={(e) => onSelectWeekFilter(e.target.value)}
              className="bg-background border border-input focus-visible:border-ring text-foreground rounded-xl px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
            >
              {currentMonthKey === 'all' ? (
                <>
                  <option value="all">📊 Total Semua Pekan</option>
                  {dedupedPlans.map((p) => {
                    const m = p.month || Number(p.start_date.split('-')[1]) || 10;
                    return (
                      <option key={p.id} value={p.id}>
                        {getMonthShortName(m)} - Minggu Ke-{p.week_number}
                      </option>
                    );
                  })}
                </>
              ) : (
                <>
                  <option value={`month-${currentMonthKey}`}>
                    📅 Seluruh {selectedMonthInfo?.label || 'Bulan'} (Akumulasi W1-W5)
                  </option>
                  {filteredMonthPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      Minggu Ke-{p.week_number} (W{p.week_number}) • {p.start_date.slice(5)} s/d {p.end_date.slice(5)}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {!isAllWeeks && !selectedWeekFilter.startsWith('month-') && (
            <button
              onClick={onNavigateToPlanning}
              className="text-xs text-link hover:text-link font-medium flex items-center px-2 py-1 rounded-lg bg-canvas hover:bg-muted border border-border transition"
            >
              Ubah Plan <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hero Achievement Card */}
      <div className="relative overflow-hidden bg-card border border-border rounded-3xl p-5 shadow-pop">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs font-semibold text-muted-foreground tracking-wider">
              {periodTitle}
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-4xl @min-[640px]:text-5xl font-black text-foreground tracking-tight">
                {formatPercent(summary.achievement_rate)}
              </span>
              <span className="text-xs text-muted-foreground">
                dari {formatKg(summary.total_target_kg)} Kg
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`px-3 py-1.5 rounded-xl border flex items-center space-x-1.5 ${statusBadge.bg}`}>
            <StatusIcon className="w-4 h-4" />
            <span className="text-xs font-bold">{statusBadge.label}</span>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="space-y-1.5 mb-5">
          <div className="w-full bg-muted rounded-full h-3.5 p-0.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                summary.achievement_rate >= 95
                  ? 'bg-success shadow-card '
                  : summary.achievement_rate >= 80
                  ? 'bg-warning shadow-card '
                  : 'bg-primary shadow-card '
              }`}
              style={{ width: `${Math.min(100, Math.max(2, summary.achievement_rate))}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] text-muted-foreground px-0.5">
            <span>Realisasi: <strong className="text-foreground">{formatKg(summary.total_actual_kg)} Kg</strong></span>
            <span>Sisa: <strong className="text-link">{formatKg(summary.remaining_target_kg)} Kg</strong></span>
          </div>
        </div>

        {/* 3-Box Key Metrics Grid */}
        <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-border">
          <div className="bg-canvas rounded-xl p-2.5 border border-border">
            <div className="flex items-center space-x-1.5 text-muted-foreground text-[11px] mb-1">
              <Target className="w-3.5 h-3.5 text-link" />
              <span>Target Rencana</span>
            </div>
            <p className="text-sm @min-[640px]:text-base font-bold text-foreground">
              {formatKg(summary.total_target_kg)} <span className="text-[10px] font-normal text-muted-foreground">Kg</span>
            </p>
          </div>

          <div className="bg-canvas rounded-xl p-2.5 border border-border">
            <div className="flex items-center space-x-1.5 text-muted-foreground text-[11px] mb-1">
              <Scale className="w-3.5 h-3.5 text-success" />
              <span>Total Hasil Jadi</span>
            </div>
            <p className="text-sm @min-[640px]:text-base font-bold text-success">
              {formatKg(summary.total_actual_kg)} <span className="text-[10px] font-normal text-muted-foreground">Kg</span>
            </p>
          </div>

          <div className="bg-canvas rounded-xl p-2.5 border border-border">
            <div className="flex items-center space-x-1.5 text-muted-foreground text-[11px] mb-1">
              <Flame className="w-3.5 h-3.5 text-warning" />
              <span>Sisa Target</span>
            </div>
            <p className="text-sm @min-[640px]:text-base font-bold text-link">
              {formatKg(summary.remaining_target_kg)} <span className="text-[10px] font-normal text-muted-foreground">Kg</span>
            </p>
          </div>
        </div>
      </div>

      {/* Target Hari Ini vs Capaian Hari Ini */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-success animate-ping" />
            <h2 className="text-sm font-bold text-foreground">Realisasi Hari Ini ({todayStr})</h2>
          </div>
          <span className="text-xs text-muted-foreground">{todayLogs.length} Entri</span>
        </div>

        <div className="bg-canvas rounded-xl p-3 border border-border flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground">Total Hasil Produksi Jadi Hari Ini</p>
            <p className="text-2xl font-black text-success mt-0.5">
              {formatKg(todayActualKg)} <span className="text-xs text-muted-foreground font-normal">Kg</span>
            </p>
          </div>
          <button
            onClick={onNavigateToInput}
            className="py-2 px-3 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs flex items-center space-x-1.5 shadow-card transition"
          >
            <span>+ Input Hasil</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Line Chart Tren Produksi Mingguan (Target vs Realisasi Garis) */}
      <WeeklyLineChart 
        plans={currentMonthKey === 'all' ? dedupedPlans : filteredMonthPlans} 
        logs={logs} 
        titleSuffix={currentMonthKey === 'all' ? 'Semua Bulan' : (selectedMonthInfo?.label || 'Bulan Terpilih')}
        selectedPlanId={selectedWeekFilter.startsWith('month-') || selectedWeekFilter === 'all' ? undefined : selectedWeekFilter}
        onSelectPlanId={(planId) => {
          onSelectWeekFilter(planId === 'all' ? (currentMonthKey === 'all' ? 'all' : `month-${currentMonthKey}`) : planId);
        }}
      />

      {/* Detail Pencapaian per Barang (SKU) */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
        <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-link" />
              Pencapaian per Barang
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Daftar target dan realisasi hasil jadi per produk ({targetSkuList.length} Item SKU).
            </p>
          </div>

          {/* Filter Tab: Semua, Belum Achieved, Sudah Tuntas */}
          <div className="flex items-center gap-1.5 bg-canvas p-1 rounded-xl border border-border self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setSkuTab('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                skuTab === 'all'
                  ? 'bg-primary text-primary-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span>Semua</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                skuTab === 'all' ? 'bg-accent text-foreground' : 'bg-muted text-foreground'
              }`}>
                {targetSkuList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSkuTab('unachieved')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                skuTab === 'unachieved'
                  ? 'bg-warning text-warning-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <AlertCircle className={`w-3.5 h-3.5 ${skuTab === 'unachieved' ? 'text-foreground' : 'text-warning'}`} />
              <span>Belum Achieved</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                skuTab === 'unachieved' ? 'bg-accent text-foreground' : 'bg-warning-subtle text-warning'
              }`}>
                {unachievedSkuList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSkuTab('achieved')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                skuTab === 'achieved'
                  ? 'bg-primary text-primary-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${skuTab === 'achieved' ? 'text-foreground' : 'text-success'}`} />
              <span>Sudah Tuntas</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                skuTab === 'achieved' ? 'bg-accent text-foreground' : 'bg-success-subtle text-success'
              }`}>
                {achievedSkuList.length}
              </span>
            </button>
          </div>
        </div>

        {targetSkuList.length === 0 ? (
          <p className="text-xs text-subtle-foreground py-6 text-center">
            Belum ada target barang pada periode ini. Buka menu Plan untuk menambahkan barang.
          </p>
        ) : displayedSkuList.length === 0 ? (
          <div className="py-8 text-center space-y-1.5">
            {skuTab === 'unachieved' ? (
              <>
                <p className="text-sm font-semibold text-success">
                  🎉 Semua Target Barang Sudah Tercapai!
                </p>
                <p className="text-xs text-muted-foreground">
                  Seluruh barang dalam rencana produksi periode ini telah mencapai target 100%.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">
                  Belum Ada Barang yang Tuntas
                </p>
                <p className="text-xs text-subtle-foreground">
                  Belum ada barang yang mencapai target 100% pada periode ini.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedSkuList.map((item) => {
              const isItemFinished = !item.isUnplanned && item.percent >= 100;
              return (
                <div
                  key={item.sku_id}
                  className="bg-canvas hover:bg-canvas border border-border rounded-2xl p-3.5 space-y-2.5 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-card text-foreground border border-border">
                          {item.sku_code}
                        </span>
                        {item.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-card text-muted-foreground border border-border">
                            {item.category}
                          </span>
                        )}
                        {item.isUnplanned ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning-subtle text-warning border border-warning-border font-bold flex items-center gap-1">
                            ⚠️ Tidak Ada di Plan
                          </span>
                        ) : isItemFinished ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-success-subtle text-success font-bold">
                            Tuntas ✅
                          </span>
                        ) : null}
                      </div>
                      <h4 className="text-xs @min-[640px]:text-sm font-bold text-foreground mt-1 truncate">
                        {item.sku_name}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      {item.isUnplanned ? (
                        <span className="text-xs @min-[640px]:text-sm font-bold text-warning">
                          Di Luar Plan
                        </span>
                      ) : (
                        <span className={`text-xs @min-[640px]:text-sm font-black ${
                          isItemFinished ? 'text-success' : 'text-foreground'
                        }`}>
                          {formatPercent(item.percent)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.isUnplanned
                          ? 'bg-warning'
                          : isItemFinished
                          ? 'bg-success'
                          : item.percent >= 70
                          ? 'bg-warning'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${item.isUnplanned ? 100 : Math.min(100, Math.max(2, item.percent))}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5">
                    <span>
                      Hasil: <strong className="text-success font-semibold">{formatKg(item.actual_kg)} Kg</strong>
                    </span>
                    <span>
                      Target: <strong className={item.isUnplanned ? 'text-warning/80 font-normal italic' : 'text-foreground font-semibold'}>
                        {item.isUnplanned ? '0 Kg (Di luar Plan)' : `${formatKg(item.target_kg)} Kg`}
                      </strong>
                    </span>
                    <span>
                      Sisa: <strong className={item.isUnplanned ? 'text-subtle-foreground' : 'text-link font-semibold'}>
                        {item.isUnplanned ? '-' : `${formatKg(item.remaining_kg)} Kg`}
                      </strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

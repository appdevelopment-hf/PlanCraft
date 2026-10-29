'use client';

import React, { useState, useMemo } from 'react';
import { WeeklyProductionPlan, DailyProductionLog, getMonthShortName } from '@/types';
import { formatKg, formatPercent } from '@/lib/storage';
import { 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  ArrowLeft,
  Activity,
  BarChart2,
  CalendarDays
} from '@/components/icons';

interface WeeklyLineChartProps {
  plans: WeeklyProductionPlan[];
  logs: DailyProductionLog[];
  titleSuffix?: string;
  selectedPlanId?: string;
  onSelectPlanId?: (planId: string) => void;
}

/**
 * Helper menghasilkan daftar hari (Senin s/d Sabtu/Minggu) dari start_date s/d end_date
 */
function getDaysList(startStr: string, endStr: string) {
  const result: Array<{
    dateStr: string;
    dayName: string;
    shortDate: string;
    fullLabel: string;
  }> = [];
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const fullDayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  try {
    const [sY, sM, sD] = startStr.split('-').map(Number);
    const [eY, eM, eD] = endStr.split('-').map(Number);
    const cur = new Date(sY, sM - 1, sD, 12, 0, 0);
    const end = new Date(eY, eM - 1, eD, 12, 0, 0);

    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayIdx = cur.getDay();

      result.push({
        dateStr,
        dayName: dayNames[dayIdx],
        shortDate: `${d}/${m}`,
        fullLabel: `${fullDayNames[dayIdx]}, ${d}/${m}`,
      });

      cur.setDate(cur.getDate() + 1);
    }
  } catch (e) {
    console.error('Error generating days list:', e);
  }

  return result;
}

export const WeeklyLineChart: React.FC<WeeklyLineChartProps> = ({
  plans,
  logs,
  titleSuffix,
  selectedPlanId,
  onSelectPlanId,
}) => {
  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);
  const [dailyViewMode, setDailyViewMode] = useState<'cumulative' | 'daily'>('cumulative');

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Deduplicate and sort plans chronologically by start_date ascending
  const sortedPlans = useMemo(() => {
    const map = new Map<string, WeeklyProductionPlan>();
    plans.forEach((p) => {
      const m = p.month || Number(p.start_date.split('-')[1]) || 10;
      const w = Number(p.week_number) > 5 ? 1 : (Number(p.week_number) || 1);
      const y = p.year || 2026;
      const key = `${y}-${m}-${w}`;
      if (!map.has(key)) {
        map.set(key, p);
      } else {
        const existing = map.get(key)!;
        if (p.status === 'active' && existing.status !== 'active') {
          map.set(key, p);
        } else if ((p.targets?.length || 0) > (existing.targets?.length || 0) && existing.status !== 'active') {
          map.set(key, p);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [plans]);

  // Check if a specific plan is actively chosen
  const activePlan = useMemo(() => {
    if (!selectedPlanId) return null;
    return plans.find((p) => p.id === selectedPlanId) || sortedPlans.find((p) => p.id === selectedPlanId) || null;
  }, [selectedPlanId, plans, sortedPlans]);

  const isDailyMode = Boolean(activePlan);

  // -------------------------------------------------------------
  // 1. DATA FOR DAILY MODE (When a week is selected)
  // -------------------------------------------------------------
  const daysList = useMemo(() => {
    if (!activePlan) return [];
    return getDaysList(activePlan.start_date, activePlan.end_date);
  }, [activePlan]);

  const dailyData = useMemo(() => {
    if (!activePlan || daysList.length === 0) return [];
    const totalTarget = activePlan.targets.reduce((acc, t) => acc + (t.target_kg || 0), 0);
    const dailyTargetAverage = Math.round((totalTarget / daysList.length) * 10) / 10;
    const planLogs = logs.filter((l) => l.plan_id === activePlan.id);

    let runningActual = 0;
    let runningTarget = 0;

    return daysList.map((day, idx) => {
      const dayLogs = planLogs.filter((l) => l.date === day.dateStr);
      const dayActual = dayLogs.reduce((acc, l) => acc + (l.actual_kg || 0), 0);

      runningActual += dayActual;
      runningTarget += dailyTargetAverage;
      if (idx === daysList.length - 1) {
        runningTarget = totalTarget;
      }

      const percentDaily = dailyTargetAverage > 0 ? (dayActual / dailyTargetAverage) * 100 : 0;
      const percentCum = totalTarget > 0 ? (runningActual / totalTarget) * 100 : 0;
      const isPastOrToday = day.dateStr <= todayStr;

      return {
        dateStr: day.dateStr,
        dayName: day.dayName,
        shortDate: day.shortDate,
        fullLabel: day.fullLabel,
        dayLogs,
        dayActualKg: Math.round(dayActual * 10) / 10,
        dayTargetKg: dailyTargetAverage,
        cumActualKg: Math.round(runningActual * 10) / 10,
        cumTargetKg: Math.round(runningTarget * 10) / 10,
        percentDaily: Math.round(percentDaily * 10) / 10,
        percentCum: Math.round(percentCum * 10) / 10,
        isPastOrToday,
        isToday: day.dateStr === todayStr,
      };
    });
  }, [activePlan, daysList, logs, todayStr]);

  // -------------------------------------------------------------
  // 2. DATA FOR WEEKLY MODE (When viewing multi-week overview)
  // -------------------------------------------------------------
  const weekData = useMemo(() => {
    return sortedPlans.map((plan) => {
      const totalTarget = plan.targets.reduce((acc, t) => acc + (t.target_kg || 0), 0);
      const planLogs = logs.filter((l) => l.plan_id === plan.id);
      const totalActual = planLogs.reduce((acc, l) => acc + (l.actual_kg || 0), 0);
      const percent = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
      const isAchieved = totalTarget > 0 && totalActual >= totalTarget;
      const m = plan.month || Number(plan.start_date.split('-')[1]) || 10;

      return {
        id: plan.id,
        weekNumber: plan.week_number,
        month: m,
        year: plan.year,
        label: `${getMonthShortName(m)} W${plan.week_number}`,
        dateRange: `${plan.start_date.slice(5)} s/d ${plan.end_date.slice(5)}`,
        targetKg: Math.round(totalTarget * 10) / 10,
        actualKg: Math.round(totalActual * 10) / 10,
        percent: Math.round(percent * 10) / 10,
        isAchieved,
        status: plan.status,
      };
    });
  }, [sortedPlans, logs]);

  if (!isDailyMode && weekData.length === 0) {
    return null;
  }

  // -------------------------------------------------------------
  // 3. SVG DIMENSIONS & SCALE CALCULATIONS
  // -------------------------------------------------------------
  const svgWidth = 560;
  const svgHeight = 220;
  const padLeft = 50;
  const padRight = 35;
  const padTop = 35;
  const padBottom = 35;

  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  // Values based on active mode
  let chartPointsCount = 0;
  let maxVal = 1000;
  let getTargetVal: (i: number) => number = () => 0;
  let getActualVal: (i: number) => number = () => 0;
  let getLabelText: (i: number) => string = () => '';
  let getNodeKey: (i: number) => string = () => '';

  if (isDailyMode) {
    chartPointsCount = dailyData.length;
    if (dailyViewMode === 'cumulative') {
      maxVal = Math.max(...dailyData.map((d) => Math.max(d.cumTargetKg, d.cumActualKg)), 1000);
      getTargetVal = (i) => dailyData[i].cumTargetKg;
      getActualVal = (i) => dailyData[i].cumActualKg;
    } else {
      maxVal = Math.max(...dailyData.map((d) => Math.max(d.dayTargetKg, d.dayActualKg)), 500);
      getTargetVal = (i) => dailyData[i].dayTargetKg;
      getActualVal = (i) => dailyData[i].dayActualKg;
    }
    getLabelText = (i) => `${dailyData[i].dayName} ${dailyData[i].shortDate}`;
    getNodeKey = (i) => dailyData[i].dateStr;
  } else {
    chartPointsCount = weekData.length;
    maxVal = Math.max(...weekData.map((d) => Math.max(d.targetKg, d.actualKg)), 1000);
    getTargetVal = (i) => weekData[i].targetKg;
    getActualVal = (i) => weekData[i].actualKg;
    getLabelText = (i) => weekData[i].label;
    getNodeKey = (i) => weekData[i].id;
  }

  // Add headroom
  const stepUnit = maxVal > 5000 ? 1000 : maxVal > 2000 ? 500 : 250;
  const yMax = Math.ceil((maxVal * 1.15) / stepUnit) * stepUnit;

  const getX = (index: number) => {
    if (chartPointsCount <= 1) return padLeft + plotW / 2;
    return padLeft + (index / (chartPointsCount - 1)) * plotW;
  };

  const getY = (val: number) => {
    const ratio = Math.min(1, Math.max(0, val / yMax));
    return padTop + (1 - ratio) * plotH;
  };

  // Build SVG Paths
  const indices = Array.from({ length: chartPointsCount }, (_, i) => i);
  const targetPath = indices
    .map((i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(getTargetVal(i))}`)
    .join(' ');

  const actualPath = indices
    .map((i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(getActualVal(i))}`)
    .join(' ');

  const areaPath =
    actualPath +
    ` L ${getX(chartPointsCount - 1)} ${padTop + plotH} L ${getX(0)} ${padTop + plotH} Z`;

  // Grid steps (0%, 33%, 66%, 100%)
  const gridSteps = [0, yMax * 0.33, yMax * 0.66, yMax];

  return (
    <div className="bg-card border border-border rounded-2xl p-4 @min-[640px]:p-5 shadow-card space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col @min-[640px]:flex-row @min-[640px]:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            {isDailyMode && onSelectPlanId && (
              <button
                onClick={() => onSelectPlanId('all')}
                className="p-1 px-2 text-xs font-semibold rounded-lg bg-muted hover:bg-accent text-foreground hover:text-foreground flex items-center space-x-1 transition border border-border-strong"
                title="Kembali ke tampilan semua pekan"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Semua Pekan</span>
              </button>
            )}
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-success" />
              {isDailyMode
                ? `Grafik Tren Harian: Week ${activePlan?.week_number} (${activePlan?.start_date.slice(5)} s/d ${activePlan?.end_date.slice(5)})`
                : `Grafik Tren Produksi Mingguan ${titleSuffix ? `(${titleSuffix})` : ''}`}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isDailyMode
              ? dailyViewMode === 'cumulative'
                ? 'Garis akumulasi target mingguan vs realisasi hasil jadi yang telah tercapai hari demi hari.'
                : 'Perbandingan output hasil jadi per hari terhadap rata-rata target harian.'
              : 'Garis target membandingkan realisasi hasil jadi untuk melihat ketercapaian per pekan. Klik titik untuk melihat tren harian.'}
          </p>
        </div>

        {/* Legend & Toggle Mode */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {/* Daily View Mode Switcher */}
          {isDailyMode && (
            <div className="flex items-center bg-canvas p-1 rounded-xl border border-border text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setDailyViewMode('cumulative')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center space-x-1 ${
                  dailyViewMode === 'cumulative'
                    ? 'bg-primary text-primary-foreground font-bold shadow-card'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Activity className="w-3 h-3" />
                <span>Akumulasi Berjalan</span>
              </button>
              <button
                type="button"
                onClick={() => setDailyViewMode('daily')}
                className={`px-2.5 py-1 rounded-lg transition flex items-center space-x-1 ${
                  dailyViewMode === 'daily'
                    ? 'bg-primary text-primary-foreground font-bold shadow-card'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BarChart2 className="w-3 h-3" />
                <span>Output per Hari</span>
              </button>
            </div>
          )}

          {/* Legend Badges */}
          <div className="flex items-center space-x-3 text-[11px] font-semibold bg-canvas px-3 py-1.5 rounded-xl border border-border">
            <div className="flex items-center space-x-1.5">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-primary inline-block" />
              <span className="text-link">
                {isDailyMode && dailyViewMode === 'daily' ? 'Target Harian' : 'Garis Target'}
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-4 h-1 bg-success rounded-full inline-block" />
              <span className="text-success">
                {isDailyMode && dailyViewMode === 'daily' ? 'Hasil Harian' : 'Hasil Jadi'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive SVG Chart */}
      <div className="relative overflow-hidden bg-canvas border border-border rounded-2xl p-2 pt-4">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y Labels */}
          {gridSteps.map((val, idx) => {
            const y = getY(val);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Area Fill for Actual Line */}
          <path d={areaPath} fill="url(#actualGradient)" />

          {/* Target Line (Dashed Rose) */}
          <path
            d={targetPath}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2.5"
            strokeDasharray="5 4"
            strokeLinecap="round"
          />

          {/* Actual Line (Solid Emerald) */}
          <path
            d={actualPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points & Labels */}
          {indices.map((i) => {
            const x = getX(i);
            const targetVal = getTargetVal(i);
            const actualVal = getActualVal(i);
            const yT = getY(targetVal);
            const yA = getY(actualVal);
            const isHovered = activeTooltipIndex === i;
            const nodeKey = getNodeKey(i);
            const labelText = getLabelText(i);

            // In daily mode
            const dayItem = isDailyMode ? dailyData[i] : null;
            const weekItem = !isDailyMode ? weekData[i] : null;

            const isAchieved = isDailyMode
              ? (dailyViewMode === 'cumulative' ? dayItem!.cumActualKg >= dayItem!.cumTargetKg : dayItem!.dayActualKg >= dayItem!.dayTargetKg)
              : weekItem!.isAchieved;

            const isToday = isDailyMode && dayItem?.isToday;

            return (
              <g
                key={nodeKey}
                className="cursor-pointer group"
                onClick={() => {
                  setActiveTooltipIndex(i);
                  if (!isDailyMode && onSelectPlanId && weekItem) {
                    onSelectPlanId(weekItem.id);
                  }
                }}
              >
                {/* Target Point (Square/Diamond) */}
                <rect
                  x={x - 3.5}
                  y={yT - 3.5}
                  width="7"
                  height="7"
                  fill="#090d16"
                  stroke="#f43f5e"
                  strokeWidth="2"
                  rx="1"
                />

                {/* Actual Point (Circle) */}
                <circle
                  cx={x}
                  cy={yA}
                  r={isHovered ? 7.5 : isToday ? 6.5 : 5}
                  fill={isAchieved ? '#10b981' : actualVal > 0 ? '#f59e0b' : '#f43f5e'}
                  stroke={isToday ? '#fbbf24' : isHovered ? '#ffffff' : '#0f172a'}
                  strokeWidth={isToday || isHovered ? 2.5 : 2}
                  className="transition-all duration-200"
                />

                {/* Percentage / Value Tag Above Node */}
                <g transform={`translate(${x}, ${yA - 10})`}>
                  <rect
                    x="-22"
                    y="-13"
                    width="44"
                    height="14"
                    rx="4"
                    fill={isAchieved ? '#064e3b' : actualVal > 0 ? '#78350f' : '#881337'}
                    stroke={isAchieved ? '#10b981' : actualVal > 0 ? '#f59e0b' : '#f43f5e'}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="-3"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="8.5"
                    fontWeight="bold"
                  >
                    {isDailyMode
                      ? dailyViewMode === 'cumulative'
                        ? `${dayItem?.percentCum.toFixed(0)}%`
                        : `${Math.round(actualVal)} kg`
                      : `${weekItem?.percent.toFixed(0)}%`}
                  </text>
                </g>

                {/* X Axis Label */}
                <text
                  x={x}
                  y={svgHeight - 14}
                  textAnchor="middle"
                  fill={isToday ? '#fbbf24' : isHovered ? '#ffffff' : '#94a3b8'}
                  fontSize={isDailyMode ? '10' : '11'}
                  fontWeight={isToday || isHovered ? 'bold' : '600'}
                >
                  {labelText}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Active Info if node is clicked/hovered */}
        {activeTooltipIndex !== null && (
          <div className="mt-2 bg-card border border-border rounded-xl p-3 text-xs animate-in fade-in">
            {isDailyMode && dailyData[activeTooltipIndex] ? (
              (() => {
                const item = dailyData[activeTooltipIndex];
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-foreground flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-link" />
                          <span>{item.fullLabel}</span>
                          {item.isToday && (
                            <span className="px-1.5 py-0.2 text-[9px] bg-warning-subtle text-warning rounded font-bold">
                              HARI INI
                            </span>
                          )}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.dayActualKg >= item.dayTargetKg
                              ? 'bg-success-subtle text-success border border-success-border'
                              : item.dayActualKg > 0
                              ? 'bg-warning-subtle text-warning border border-warning-border'
                              : 'bg-muted text-muted-foreground border border-border-strong'
                          }`}
                        >
                          {item.dayActualKg >= item.dayTargetKg
                            ? 'Target Hari Tercapai ✅'
                            : item.dayActualKg > 0
                            ? 'Sebagian Tercapai ⏱️'
                            : 'Belum Ada Hasil Produksi'}
                        </span>
                      </div>
                      <div className="text-right text-foreground">
                        {dailyViewMode === 'cumulative' ? (
                          <>
                            Target Akumulasi:{' '}
                            <strong className="text-link">{formatKg(item.cumTargetKg)} Kg</strong> | Realisasi:{' '}
                            <strong className="text-success ml-1">{formatKg(item.cumActualKg)} Kg</strong>{' '}
                            <span className="ml-1 text-foreground font-bold">({formatPercent(item.percentCum)})</span>
                          </>
                        ) : (
                          <>
                            Target Rata-rata:{' '}
                            <strong className="text-link">{formatKg(item.dayTargetKg)} Kg</strong> | Output:{' '}
                            <strong className="text-success ml-1">{formatKg(item.dayActualKg)} Kg</strong>{' '}
                            <span className="ml-1 text-foreground font-bold">({formatPercent(item.percentDaily)})</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Breakdown SKU on that day if any */}
                    {item.dayLogs.length > 0 && (
                      <div className="pt-1.5 border-t border-border flex flex-wrap gap-2 text-[11px]">
                        <span className="text-muted-foreground font-medium">Hasil SKU:</span>
                        {item.dayLogs.map((l) => (
                          <span
                            key={l.id}
                            className="bg-canvas px-2 py-0.5 rounded border border-border text-foreground"
                          >
                            <strong>{l.sku_name || l.sku_code}:</strong>{' '}
                            <span className="text-success font-bold">{formatKg(l.actual_kg)} Kg</span>
                            {l.bottleneck_reason && l.bottleneck_reason !== 'Normal / Lancar' && (
                              <span className="text-warning ml-1">({l.bottleneck_reason})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : !isDailyMode && weekData[activeTooltipIndex] ? (
              (() => {
                const w = weekData[activeTooltipIndex];
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-foreground">
                        Minggu Ke-{w.weekNumber} ({w.dateRange})
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          w.isAchieved
                            ? 'bg-success-subtle text-success border border-success-border'
                            : 'bg-primary/10 text-link border border-primary/30'
                        }`}
                      >
                        {w.isAchieved ? 'Target Tercapai ✅' : 'Belum Tercapai ❌'}
                      </span>
                    </div>
                    <div className="text-right text-foreground">
                      Target: <strong className="text-link">{formatKg(w.targetKg)} Kg</strong> | Hasil Jadi:{' '}
                      <strong className="text-success ml-1">{formatKg(w.actualKg)} Kg</strong>{' '}
                      <span className="ml-1 text-foreground font-bold">({formatPercent(w.percent)})</span>
                    </div>
                  </div>
                );
              })()
            ) : null}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. CARDS GRID (Daily cards in Daily Mode, Week cards in Week Mode) */}
      {/* ------------------------------------------------------------- */}
      {isDailyMode ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
            <span className="font-semibold text-foreground flex items-center space-x-1">
              <CalendarDays className="w-3.5 h-3.5 text-link" />
              <span>Rincian Hasil per Hari ({dailyData.length} Hari)</span>
            </span>
            <span className="text-[11px] text-subtle-foreground">
              Target Rata-rata:{' '}
              <strong className="text-link">
                {formatKg(dailyData[0]?.dayTargetKg || 0)} Kg/hari
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 @min-[640px]:grid-cols-6 gap-2">
            {dailyData.map((d, idx) => {
              const isSelected = activeTooltipIndex === idx;
              const hasOutput = d.dayActualKg > 0;
              const isTargetMet = d.dayActualKg >= d.dayTargetKg;

              return (
                <div
                  key={d.dateStr}
                  onClick={() => setActiveTooltipIndex(idx)}
                  className={`p-2.5 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 border-primary ring-2 ring-primary/30 text-foreground'
                      : isTargetMet
                      ? 'bg-success-subtle border-success-border text-success hover:border-success-border'
                      : hasOutput
                      ? 'bg-canvas border-border text-foreground hover:border-border-strong'
                      : 'bg-canvas border-border text-subtle-foreground hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${d.isToday ? 'text-warning' : 'text-foreground'}`}>
                      {d.dayName} {d.shortDate}
                    </span>
                    {isTargetMet ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    ) : hasOutput ? (
                      <Clock className="w-3.5 h-3.5 text-warning" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-disabled-foreground" />
                    )}
                  </div>

                  <div className="mt-1">
                    <div className="text-[11px] font-extrabold text-foreground">
                      {formatKg(d.dayActualKg)} <span className="text-[9px] font-normal text-muted-foreground">Kg</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-between">
                      <span>Target: {formatKg(d.dayTargetKg)}</span>
                      <span
                        className={`font-bold ${
                          isTargetMet ? 'text-success' : hasOutput ? 'text-warning' : 'text-subtle-foreground'
                        }`}
                      >
                        {formatPercent(d.percentDaily)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 @min-[640px]:grid-cols-4 gap-2 pt-1">
          {weekData.map((d, idx) => {
            const isSelected = selectedPlanId === d.id;
            return (
              <div
                key={d.id}
                onClick={() => {
                  setActiveTooltipIndex(idx);
                  if (onSelectPlanId) {
                    onSelectPlanId(d.id);
                  }
                }}
                className={`p-2.5 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-primary/10 border-primary ring-2 ring-primary/30 text-foreground'
                    : d.isAchieved
                    ? 'bg-success-subtle border-success-border text-success hover:border-success-border'
                    : d.actualKg > 0
                    ? 'bg-canvas border-border text-foreground hover:border-border-strong'
                    : 'bg-canvas border-border text-subtle-foreground hover:border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? 'text-link' : 'text-foreground'}`}>
                    {d.label} {isSelected && '• Terpilih'}
                  </span>
                  {d.isAchieved ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  ) : d.status === 'active' ? (
                    <Clock className="w-3.5 h-3.5 text-warning" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-subtle-foreground" />
                  )}
                </div>

                <div className="mt-1">
                  <div className="text-[10px] text-muted-foreground">
                    {formatKg(d.actualKg)} / {formatKg(d.targetKg)} Kg
                  </div>
                  <div className="text-xs font-extrabold mt-0.5 flex items-center justify-between">
                    <span
                      className={
                        d.isAchieved
                          ? 'text-success'
                          : d.percent >= 80
                          ? 'text-warning'
                          : 'text-link'
                      }
                    >
                      {formatPercent(d.percent)}
                    </span>
                    <span className="text-[9px] font-semibold text-muted-foreground">
                      Lihat Harian →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

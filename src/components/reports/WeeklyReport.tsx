'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  WeeklyProductionPlan, 
  DailyProductionLog, 
  WeeklySummary,
  MONTH_NAMES,
  getMonthName
} from '@/types';
import { formatKg, formatPercent, calculateWeeklySummary } from '@/lib/storage';
import { 
  BarChart3, 
  Printer, 
  FileSpreadsheet,
  Calendar
} from '@/components/icons';

interface WeeklyReportProps {
  plan: WeeklyProductionPlan;
  plans?: WeeklyProductionPlan[];
  onSelectPlan?: (plan: WeeklyProductionPlan) => void;
  logs: DailyProductionLog[];
  summary?: WeeklySummary;
}

export const WeeklyReport: React.FC<WeeklyReportProps> = ({
  plan,
  plans = [],
  logs,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    return plan.month || Number(plan.start_date?.split('-')[1]) || 10;
  });
  const [selectedWeek, setSelectedWeek] = useState<number>(() => {
    const w = Number(plan.week_number);
    return w > 5 ? 1 : (w || 1);
  });

  const handlePeriodChange = (newMonth: number, newWeek: number) => {
    setSelectedMonth(newMonth);
    setSelectedWeek(newWeek);
  };

  // Cari plan yang cocok dari daftar plans berdasarkan periode yang dipilih
  const currentPlan = useMemo(() => {
    const matched = plans.find(
      p => (p.month || Number(p.start_date.split('-')[1])) === selectedMonth && p.week_number === selectedWeek
    );
    if (matched) return matched;
    const pMonth = plan.month || Number(plan.start_date?.split('-')[1]) || 10;
    const pWeek = Number(plan.week_number) > 5 ? 1 : (Number(plan.week_number) || 1);
    if (pMonth === selectedMonth && pWeek === selectedWeek) return plan;
    return null;
  }, [plans, selectedMonth, selectedWeek, plan]);

  const isMatchedPlan = Boolean(currentPlan);
  const planMonth = currentPlan ? (currentPlan.month || Number(currentPlan.start_date.split('-')[1]) || 10) : selectedMonth;
  const planYear = currentPlan?.year || plan.year || 2026;

  // Summary dihitung khusus untuk plan yang sedang aktif/terpilih
  const effectiveSummary = useMemo(() => {
    if (!currentPlan) {
      return {
        total_target_kg: 0,
        total_actual_kg: 0,
        remaining_target_kg: 0,
        achievement_rate: 0,
        status: 'warning' as const,
        active_days: 0,
      };
    }
    return calculateWeeklySummary([currentPlan], logs);
  }, [currentPlan, logs]);

  // Generate list of working days dates from start_date to end_date
  const getDatesBetween = (start: string, end: string) => {
    const dates: { dateStr: string; dayName: string; shortDate: string }[] = [];
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    try {
      const cur = new Date(start);
      const stop = new Date(end);
      while (cur <= stop) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        dates.push({
          dateStr,
          dayName: dayNames[cur.getDay()],
          shortDate: `${d}/${m}`,
        });
        cur.setDate(cur.getDate() + 1);
      }
    } catch {
      // fallback
    }
    return dates;
  };

  const weekDates = useMemo(() => {
    if (!currentPlan?.start_date || !currentPlan?.end_date) return [];
    return getDatesBetween(currentPlan.start_date, currentPlan.end_date);
  }, [currentPlan?.start_date, currentPlan?.end_date]);

  const planLogs = useMemo(() => {
    if (!currentPlan?.id) return [];
    return logs.filter(l => l.plan_id === currentPlan.id);
  }, [logs, currentPlan?.id]);

  // Gabungkan target rencana dan produk di luar rencana yang diinput produksi
  const combinedReportItems = useMemo(() => {
    if (!currentPlan) return [];
    const items: Array<{
      sku_id: string;
      sku_code: string;
      sku_name: string;
      category: string;
      target_kg: number;
      isUnplanned: boolean;
    }> = (currentPlan.targets || []).map(t => ({
      sku_id: t.sku_id,
      sku_code: t.sku_code,
      sku_name: t.sku_name,
      category: t.category || '-',
      target_kg: t.target_kg,
      isUnplanned: false,
    }));

    const plannedSkuIds = new Set(items.map(i => i.sku_id));
    planLogs.forEach(l => {
      if (!plannedSkuIds.has(l.sku_id)) {
        plannedSkuIds.add(l.sku_id);
        items.push({
          sku_id: l.sku_id,
          sku_code: l.sku_code,
          sku_name: l.sku_name,
          category: 'Non-Plan',
          target_kg: 0,
          isUnplanned: true,
        });
      }
    });

    return items;
  }, [currentPlan, planLogs]);

  const totalDiff = effectiveSummary.total_actual_kg - effectiveSummary.total_target_kg;

  // Export CSV handler (including unplanned items with distinct mark)
  const handleExportCSV = () => {
    if (!currentPlan) {
      alert('Tidak ada rencana produksi pada periode ini untuk diexport.');
      return;
    }
    const dateHeaders = weekDates.map(d => `${d.dayName} (${d.shortDate})`).join(',');
    let csv = `Laporan Realisasi Produksi PlanCraft - Bulan ${getMonthName(planMonth)} Minggu Ke-${currentPlan.week_number} (${planYear})\n`;
    csv += `Periode: ${currentPlan.start_date} s/d ${currentPlan.end_date}\n\n`;
    csv += `Kode SKU,Nama Produk,Kategori,Target (Kg),${dateHeaders},Total Aktual (Kg),Selisih (Kg),Capaian (%)\n`;

    combinedReportItems.forEach(target => {
      const skuLogs = planLogs.filter(l => l.sku_id === target.sku_id);
      const totalActual = skuLogs.reduce((acc, l) => acc + l.actual_kg, 0);
      const diff = totalActual - target.target_kg;
      const pctStr = target.isUnplanned 
        ? 'Non-Plan' 
        : target.target_kg > 0 
        ? `${((totalActual / target.target_kg) * 100).toFixed(1)}%` 
        : '0%';

      const dailyValues = weekDates.map(d => {
        const dayLogs = skuLogs.filter(l => l.date === d.dateStr);
        const daySum = dayLogs.reduce((acc, l) => acc + l.actual_kg, 0);
        return daySum > 0 ? daySum.toFixed(1) : '0';
      }).join(',');

      const displayName = target.isUnplanned ? `${target.sku_name} (Tidak Ada di Plan)` : target.sku_name;
      const displayCategory = target.isUnplanned ? `${target.category} (Non-Plan)` : target.category;

      csv += `"${target.sku_code}","${displayName}","${displayCategory}",${target.target_kg},${dailyValues},${totalActual.toFixed(1)},${diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)},${pctStr}\n`;
    });

    csv += `\nTOTAL RINGKASAN,,,,${effectiveSummary.total_target_kg},${effectiveSummary.total_actual_kg},${totalDiff >= 0 ? `+${totalDiff.toFixed(1)}` : totalDiff.toFixed(1)},${effectiveSummary.achievement_rate}%\n`;

    // Download trigger
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PlanCraft_Report_${planYear}_M${planMonth}_W${currentPlan.week_number}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Period Filter: Bulan Kebutuhan & Week 1 - 5 */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2 text-xs font-semibold text-foreground">
            <Calendar className="w-4 h-4 text-link" />
            <span>Pilih Periode Laporan Mingguan:</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-muted-foreground font-medium">Bulan Kebutuhan:</span>
            <select
              value={selectedMonth}
              onChange={(e) => handlePeriodChange(Number(e.target.value), selectedWeek)}
              className="bg-background border border-input focus-visible:border-ring text-foreground rounded-xl px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
            >
              {MONTH_NAMES.map((mName, idx) => (
                <option key={mName} value={idx + 1}>
                  {mName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Week 1 - 5 Selector Chips */}
        <div className="grid grid-cols-5 gap-1.5 pt-1">
          {[1, 2, 3, 4, 5].map((w) => {
            const isSelected = selectedWeek === w;
            const planForWeek = (plans || []).find(
              p => (p.month || Number(p.start_date.split('-')[1])) === selectedMonth && p.week_number === w
            );
            const hasPlan = Boolean(planForWeek);

            return (
              <button
                key={w}
                type="button"
                onClick={() => handlePeriodChange(selectedMonth, w)}
                className={`py-2 px-1.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center border cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-card '
                    : hasPlan
                    ? 'bg-canvas hover:bg-muted text-foreground border-border'
                    : 'bg-canvas hover:bg-card text-subtle-foreground border-border'
                }`}
              >
                <span>Week {w}</span>
                <span className="text-[9px] font-normal opacity-80 mt-0.5 truncate">
                  {hasPlan ? `${planForWeek!.targets?.length || 0} Target` : 'Belum Ada'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Period Status Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] bg-canvas px-3 py-2 rounded-xl border border-border gap-1.5">
          <div className="flex items-center space-x-2">
            <span className="text-muted-foreground">Laporan Pekan Terpilih:</span>
            <span className="font-bold text-foreground">
              {getMonthName(selectedMonth)} • Week {selectedWeek}
            </span>
            {isMatchedPlan ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-success-subtle text-success font-bold">
                {currentPlan?.status === 'active' ? 'Aktif' : 'Tersedia'}
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-warning-subtle text-warning font-bold">
                Plan Belum Dibuat
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {currentPlan ? `${currentPlan.start_date} s/d ${currentPlan.end_date}` : 'Belum ada rencana produksi untuk minggu ini'}
          </span>
        </div>
      </div>

      {/* Title & Actions */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card flex flex-col @min-[640px]:flex-row @min-[640px]:items-center justify-between gap-3">
        <div>
          <h1 className="text-base @min-[640px]:text-lg font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-link" />
            Rekap & Laporan Evaluasi Mingguan
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bulan {getMonthName(selectedMonth)} {planYear} • Minggu Ke-{selectedWeek} {currentPlan ? `(${currentPlan.start_date} s/d ${currentPlan.end_date})` : ''}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex-1 @min-[640px]:flex-none px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-card "
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (CSV)</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl bg-muted hover:bg-accent text-foreground font-semibold text-xs transition active:scale-95 flex items-center gap-1.5"
            title="Cetak Halaman"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards (Tanpa Susut & Tanpa Yield) */}
      <div className="grid grid-cols-2 @min-[640px]:grid-cols-4 gap-2.5">
        <div className="bg-card border border-border rounded-2xl p-3">
          <p className="text-[11px] text-muted-foreground">Target Pekan</p>
          <p className="text-lg font-black text-foreground mt-0.5">
            {formatKg(effectiveSummary.total_target_kg)} <span className="text-xs font-normal text-muted-foreground">Kg</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3">
          <p className="text-[11px] text-muted-foreground">Aktual Hasil Jadi</p>
          <p className="text-lg font-black text-success mt-0.5">
            {formatKg(effectiveSummary.total_actual_kg)} <span className="text-xs font-normal text-muted-foreground">Kg</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3">
          <p className="text-[11px] text-muted-foreground">Selisih Deviasi</p>
          <p className={`text-lg font-black mt-0.5 ${totalDiff >= 0 ? 'text-success' : 'text-link'}`}>
            {totalDiff >= 0 ? `+${formatKg(totalDiff)}` : formatKg(totalDiff)} <span className="text-xs font-normal text-muted-foreground">Kg</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3">
          <p className="text-[11px] text-muted-foreground">Pencapaian %</p>
          <p className={`text-lg font-black mt-0.5 ${
            effectiveSummary.achievement_rate >= 95 ? 'text-success' : effectiveSummary.achievement_rate >= 80 ? 'text-warning' : 'text-link'
          }`}>
            {formatPercent(effectiveSummary.achievement_rate)}
          </p>
        </div>
      </div>

      {/* Daily Matrix Table */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card overflow-hidden">
        <h2 className="text-xs font-bold text-foreground tracking-wider mb-3">
          Matriks Realisasi Harian Hasil Jadi (Kg)
        </h2>

        <div className="overflow-x-auto -mx-4 @min-[640px]:mx-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-canvas text-muted-foreground">
                <th className="py-2.5 px-3 font-semibold min-w-[150px]">Nama Barang / SKU</th>
                <th className="py-2.5 px-2 font-semibold text-right">Target (Kg)</th>
                {weekDates.map(d => (
                  <th key={d.dateStr} className="py-2.5 px-2 font-semibold text-right min-w-[55px]">
                    <div>{d.dayName}</div>
                    <div className="text-[10px] text-subtle-foreground font-normal">{d.shortDate}</div>
                  </th>
                ))}
                <th className="py-2.5 px-2 font-semibold text-right bg-card">Aktual</th>
                <th className="py-2.5 px-2 font-semibold text-right bg-card">Selisih</th>
                <th className="py-2.5 px-3 font-semibold text-right bg-card">% Capaian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(!currentPlan || combinedReportItems.length === 0) ? (
                <tr>
                  <td colSpan={weekDates.length + 5} className="py-8 text-center text-xs text-subtle-foreground">
                    Belum ada target produk atau riwayat produksi yang tercatat pada pekan ini.
                  </td>
                </tr>
              ) : (
                combinedReportItems.map(target => {
                  const skuLogs = planLogs.filter(l => l.sku_id === target.sku_id);
                  const actual = skuLogs.reduce((acc, l) => acc + l.actual_kg, 0);
                  const diff = actual - target.target_kg;
                  const pct = target.target_kg > 0 ? (actual / target.target_kg) * 100 : 0;

                  return (
                    <tr key={target.sku_id} className={`hover:bg-canvas transition ${target.isUnplanned ? 'bg-warning-subtle' : ''}`}>
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="truncate font-semibold">{target.sku_name}</span>
                          {target.isUnplanned && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-warning-subtle text-warning border border-warning-border font-bold whitespace-nowrap">
                              Tidak Ada di Plan
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-subtle-foreground font-mono">{target.sku_code}</div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-foreground">
                        {target.isUnplanned ? (
                          <span className="text-warning/80 font-normal italic">0 Kg</span>
                        ) : (
                          formatKg(target.target_kg)
                        )}
                      </td>

                      {weekDates.map(d => {
                        const dayLogs = skuLogs.filter(l => l.date === d.dateStr);
                        const daySum = dayLogs.reduce((acc, l) => acc + l.actual_kg, 0);
                        return (
                          <td key={d.dateStr} className={`py-2.5 px-2 text-right font-medium ${
                            daySum > 0 ? 'text-foreground' : 'text-disabled-foreground'
                          }`}>
                            {daySum > 0 ? formatKg(daySum) : '-'}
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-2 text-right font-bold text-success bg-canvas">
                        {formatKg(actual)}
                      </td>
                      <td className={`py-2.5 px-2 text-right font-bold bg-canvas ${
                        target.isUnplanned || diff >= 0 ? 'text-success' : 'text-link'
                      }`}>
                        {target.isUnplanned || diff >= 0 ? `+${formatKg(actual)}` : formatKg(diff)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black bg-canvas">
                        {target.isUnplanned ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-subtle text-warning border border-warning-border font-semibold">
                            Non-Plan
                          </span>
                        ) : (
                          <span className={pct >= 95 ? 'text-success' : pct >= 80 ? 'text-warning' : 'text-link'}>
                            {formatPercent(pct)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Field Bottlenecks and Log Issues */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
        <h2 className="text-xs font-bold text-foreground tracking-wider mb-2.5">
          Catatan Lapangan & Kendala
        </h2>
        {planLogs.filter(l => l.notes || (l.bottleneck_reason && l.bottleneck_reason !== 'Normal / Lancar')).length === 0 ? (
          <p className="text-xs text-subtle-foreground py-3 text-center">
            Semua proses produksi berjalan normal tanpa kendala.
          </p>
        ) : (
          <div className="space-y-2">
            {planLogs
              .filter(l => l.notes || (l.bottleneck_reason && l.bottleneck_reason !== 'Normal / Lancar'))
              .map(l => (
                <div key={l.id} className="bg-canvas border border-border rounded-xl p-2.5 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span className="font-semibold text-foreground">{l.sku_name} ({l.date})</span>
                    <span className="text-link font-medium">{l.bottleneck_reason}</span>
                  </div>
                  {l.notes && <p className="text-foreground mt-1 italic">&ldquo;{l.notes}&rdquo;</p>}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

'use client';

import React, { useState, useMemo } from 'react';
import { 
  WeeklyProductionPlan, 
  DailyProductionLog, 
  ProductSKU,
  AuthUser,
  getMonthName
} from '@/types';
import { formatKg, formatPercent, deduplicatePlansList } from '@/lib/storage';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  Scale, 
  Trash2, 
  Clock, 
  AlertCircle,
  Search,
  Plus,
  X,
  FileSpreadsheet,
  Download,
  Upload,
  Calendar,
  Check
} from '@/components/icons';
import { parseExcelFile, downloadExcelTemplate, ExcelImportRow } from '@/lib/excelHelper';

interface QuickInputFormProps {
  plan: WeeklyProductionPlan;
  plans?: WeeklyProductionPlan[];
  onSelectPlan?: (plan: WeeklyProductionPlan) => void;
  skus: ProductSKU[];
  logs: DailyProductionLog[];
  currentUser?: AuthUser | null;
  onSaveLog: (log: Omit<DailyProductionLog, 'id' | 'created_at'>) => void;
  onDeleteLog: (id: string) => void;
}

const COMMON_BOTTLENECK_TAGS = [
  'Normal / Lancar',
  'Thawing Lambat',
  'Pisau Slicer Tumpul',
  'Daging Keras / Beku Solid',
  'Tray / Plastik Habis',
  'Mesin Sealer Trouble',
  'Bahan Baku Tertunda',
];

/**
 * Helper mencari rencana produksi (week plan) yang menaungi tanggal produksi yang dipilih.
 * 1. Cek langsung rentang start_date s/d end_date
 * 2. Cek kesesuaian tahun, bulan, dan perkiraan pekan (Week 1 - 5)
 * 3. Fallback ke plan aktif jika tidak ditemukan
 */
function findPlanForDate(
  dateStr: string,
  allPlans: WeeklyProductionPlan[],
  fallbackPlan: WeeklyProductionPlan
): WeeklyProductionPlan {
  if (!dateStr || allPlans.length === 0) return fallbackPlan;

  // 1. Rentang langsung start_date s/d end_date
  const directMatch = allPlans.find(
    (p) => p.start_date && p.end_date && dateStr >= p.start_date && dateStr <= p.end_date
  );
  if (directMatch) return directMatch;

  // 2. Berdasarkan tahun, bulan, dan perkiraan week_number dari tanggal
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y && m && d) {
      let weekNum = Math.ceil(d / 7);
      if (weekNum > 5) weekNum = 5;

      const exactPeriodMatch = allPlans.find((p) => {
        const pMonth = p.month || Number(p.start_date?.split('-')[1]);
        const pYear = p.year || Number(p.start_date?.split('-')[0]);
        return pYear === y && pMonth === m && p.week_number === weekNum;
      });
      if (exactPeriodMatch) return exactPeriodMatch;

      const monthMatch = allPlans.find((p) => {
        const pMonth = p.month || Number(p.start_date?.split('-')[1]);
        const pYear = p.year || Number(p.start_date?.split('-')[0]);
        return pYear === y && pMonth === m;
      });
      if (monthMatch) return monthMatch;
    }
  } catch (e) {
    console.error('Error finding plan for date:', e);
  }

  return fallbackPlan;
}

export const QuickInputForm: React.FC<QuickInputFormProps> = ({
  plan,
  plans = [],
  onSelectPlan,
  skus,
  logs,
  currentUser,
  onSaveLog,
  onDeleteLog,
}) => {
  // Helper tanggal lokal sistem (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Default selected SKU: awalnya kosong agar pengguna memilih atau menginput sendiri
  const [selectedSku, setSelectedSku] = useState<{
    id: string;
    code: string;
    name: string;
    targetKg?: number;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [date, setDate] = useState<string>(todayStr);
  const [actualKg, setActualKg] = useState<string>('');
  const [bottleneck, setBottleneck] = useState<string>('Normal / Lancar');
  const [notes, setNotes] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Deduplikasi daftar rencana produksi
  const dedupedPlans = useMemo(() => deduplicatePlansList(plans), [plans]);

  // Modal Import Excel state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ExcelImportRow[]>([]);
  const [importDate, setImportDate] = useState<string>(todayStr);
  const [importBottleneck, setImportBottleneck] = useState<string>('Normal / Lancar');
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Otomatis deteksi rencana (Week) berdasarkan tanggal produksi yang dipilih
  const activePlanForDate = useMemo(() => {
    return findPlanForDate(date, dedupedPlans, plan);
  }, [date, dedupedPlans, plan]);

  const importPlanForDate = useMemo(() => {
    return findPlanForDate(importDate, dedupedPlans, plan);
  }, [importDate, dedupedPlans, plan]);

  // History tab filter: 'plan' = only week of selected date, 'selected' = only selected date, 'all' = all
  const [historyFilter, setHistoryFilter] = useState<'plan' | 'selected' | 'all'>('plan');

  // Set SKU ID yang terdaftar dalam target plan untuk week terpilih
  const plannedSkuIdSet = useMemo(
    () => new Set((activePlanForDate.targets || []).map((t) => t.sku_id)),
    [activePlanForDate.targets]
  );

  // Filtered SKUs for autocomplete: prioritaskan target di week yang dipilih
  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    // First: Plan targets in active week
    const inPlan = (activePlanForDate.targets || [])
      .filter((t) => !query || t.sku_name.toLowerCase().includes(query) || t.sku_code.toLowerCase().includes(query))
      .map((t) => ({
        id: t.sku_id,
        code: t.sku_code,
        name: t.sku_name,
        category: t.category,
        isInPlan: true,
        targetKg: t.target_kg,
      }));

    // Second: Other Master SKUs not in plan
    const inPlanIds = new Set((activePlanForDate.targets || []).map((t) => t.sku_id));
    const notInPlan = skus
      .filter((s) => !inPlanIds.has(s.id))
      .filter((s) => !query || s.name.toLowerCase().includes(query) || s.sku_code.toLowerCase().includes(query))
      .map((s) => ({
        id: s.id,
        code: s.sku_code,
        name: s.name,
        category: s.category,
        isInPlan: false,
        targetKg: undefined,
      }));

    return [...inPlan, ...notInPlan].slice(0, 50);
  }, [activePlanForDate, skus, searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSku) {
      alert('Pilih SKU / nama barang terlebih dahulu.');
      return;
    }

    const kg = parseFloat(actualKg);
    if (isNaN(kg) || kg <= 0) {
      alert('Masukkan total berat hasil jadi (Kg) yang valid.');
      return;
    }

    onSaveLog({
      plan_id: activePlanForDate.id,
      sku_id: selectedSku.id,
      sku_code: selectedSku.code,
      sku_name: selectedSku.name,
      date: date,
      actual_kg: Math.round(kg * 10) / 10,
      bottleneck_reason: bottleneck,
      notes: notes.trim() || undefined,
    });

    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#f43f5e', '#10b981', '#fbbf24'],
    });

    setSuccessMsg(
      `Hasil produksi ${formatKg(kg)} Kg untuk ${selectedSku.name} berhasil disimpan ke Week ${activePlanForDate.week_number}!`
    );
    setSelectedSku(null);
    setSearchQuery('');
    setActualKg('');
    setNotes('');

    setTimeout(() => {
      setSuccessMsg(null);
    }, 3500);
  };

  // Excel Import File Selection & Parsing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsParsingExcel(true);
    setImportError(null);

    try {
      const rows = await parseExcelFile(file, skus);
      setImportRows(rows);
    } catch (err: any) {
      setImportError(err.message || 'Gagal membaca file Excel.');
      setImportRows([]);
    } finally {
      setIsParsingExcel(false);
    }
  };

  // Apply Batch Excel Production Logs
  const handleApplyExcelLogs = () => {
    const validRows = importRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('Tidak ada baris data hasil produksi yang valid.');
      return;
    }

    let savedCount = 0;
    validRows.forEach((row) => {
      onSaveLog({
        plan_id: importPlanForDate.id,
        sku_id: row.matchedSku ? row.matchedSku.id : `sku-${row.sku.toLowerCase()}`,
        sku_code: row.sku,
        sku_name: row.name,
        date: importDate,
        actual_kg: row.qty,
        bottleneck_reason: importBottleneck,
        notes: 'Import Excel Batch',
      });
      savedCount++;
    });

    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#10b981', '#3b82f6', '#f59e0b'],
    });

    setIsImportModalOpen(false);
    setImportFile(null);
    setImportRows([]);
    setSuccessMsg(
      `Berhasil mengimpor ${savedCount} entri hasil produksi ke Week ${importPlanForDate.week_number}!`
    );
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const displayedLogs = useMemo(() => {
    if (historyFilter === 'plan') {
      return logs.filter((l) => l.plan_id === activePlanForDate.id);
    }
    if (historyFilter === 'selected') {
      return logs.filter((l) => l.date === date);
    }
    return logs;
  }, [logs, historyFilter, activePlanForDate.id, date]);

  return (
    <div className="space-y-4 pb-24">
      {/* Title Card */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base @min-[640px]:text-lg font-bold text-foreground flex items-center gap-2">
            <Scale className="w-5 h-5 text-link" />
            Input Hasil Produksi Jadi
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Pilih barang/SKU, lalu masukkan total berat hasil jadi (Kg) yang ditimbang.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsImportModalOpen(true)}
          className="px-3 py-2 rounded-xl bg-success-subtle hover:bg-success text-foreground text-xs font-bold transition flex items-center space-x-1.5 shadow-card cursor-pointer self-start sm:self-auto"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Import Excel Hasil</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-success-subtle border border-success-border text-success rounded-2xl p-3.5 flex items-center space-x-2 text-xs font-semibold animate-in fade-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Input Form */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-4 @min-[640px]:p-5 shadow-pop space-y-4">
        {/* Date Selector & Auto-detected Week */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Tanggal Produksi
            </label>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-success-subtle text-success border border-success-border font-medium">
              Bisa Pilih Tanggal (Termasuk Back-Date)
            </span>
          </div>
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-canvas border border-border focus-visible:border-ring rounded-xl px-3.5 py-2.5 text-xs text-foreground transition cursor-pointer"
            />
          </div>

          {/* Indikator Otomatis Masuk ke Week Mana */}
          <div className="mt-1.5 flex items-center justify-between text-xs bg-canvas px-3 py-2 rounded-xl border border-border">
            <div className="flex items-center space-x-2">
              <Calendar className="w-3.5 h-3.5 text-link shrink-0" />
              <span className="text-muted-foreground">Otomatis masuk ke:</span>
              <span className="font-bold text-foreground">
                Week {activePlanForDate.week_number} • {activePlanForDate.title}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {activePlanForDate.start_date.slice(5)} s/d {activePlanForDate.end_date.slice(5)}
            </span>
          </div>
        </div>

        {/* SKU Selector / Autocomplete */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Nama Barang / SKU
          </label>

          {selectedSku ? (
            <div className="bg-canvas border border-primary/30 rounded-xl p-3 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-card text-foreground border border-border">
                    {selectedSku.code}
                  </span>
                  {selectedSku.targetKg && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-link border border-primary/30">
                      Target: {formatKg(selectedSku.targetKg)} Kg
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-bold text-foreground mt-1 truncate">
                  {selectedSku.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSku(null);
                  setSearchQuery('');
                }}
                className="p-1.5 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="flex items-center bg-canvas border border-border rounded-xl px-3.5 py-2.5">
                <Search className="w-4 h-4 text-subtle-foreground mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Ketik kode SKU atau nama barang untuk memilih..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredOptions.length > 0) {
                        const first = filteredOptions[0];
                        setSelectedSku({
                          id: first.id,
                          code: first.code,
                          name: first.name,
                          targetKg: first.targetKg,
                        });
                        setIsDropdownOpen(false);
                        setSearchQuery('');
                      } else if (searchQuery.trim()) {
                        setSelectedSku({
                          id: `sku-custom-${Date.now().toString(36)}`,
                          code: searchQuery.trim().toUpperCase(),
                          name: searchQuery.trim(),
                        });
                        setIsDropdownOpen(false);
                        setSearchQuery('');
                      }
                    }
                  }}
                  className="w-full bg-transparent text-xs text-foreground placeholder-subtle-foreground "
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-subtle-foreground hover:text-foreground rounded transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <div
                    className="bg-card border-border absolute z-30 left-0 right-0 top-full mt-1 border rounded-xl shadow-pop max-h-56 overflow-y-auto divide-y divide-border"
                  >
                    {filteredOptions.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground text-center space-y-2">
                        <p>Tidak ada barang yang cocok dalam master.</p>
                        {searchQuery.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSku({
                                id: `sku-custom-${Date.now().toString(36)}`,
                                code: searchQuery.trim().toUpperCase(),
                                name: searchQuery.trim(),
                              });
                              setIsDropdownOpen(false);
                              setSearchQuery('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-card"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Gunakan "{searchQuery.trim()}" (Input Manual)</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {filteredOptions.map((opt) => (
                          <button
                            type="button"
                            key={opt.id}
                            onClick={() => {
                              setSelectedSku({
                                id: opt.id,
                                code: opt.code,
                                name: opt.name,
                                targetKg: opt.targetKg,
                              });
                              setIsDropdownOpen(false);
                              setSearchQuery('');
                            }}
                            className="w-full text-left p-2.5 hover:bg-card transition flex items-center justify-between group cursor-pointer"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-card text-muted-foreground border border-border">
                                  {opt.code}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-card text-muted-foreground border border-border">
                                  {opt.category}
                                </span>
                                {opt.isInPlan && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-success-subtle text-success font-bold border border-success-border">
                                    Target Plan W{plan.week_number}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-semibold text-foreground group-hover:text-foreground mt-1 truncate">
                                {opt.name}
                              </p>
                            </div>
                            <Plus className="w-4 h-4 text-disabled-foreground group-hover:text-link shrink-0" />
                          </button>
                        ))}

                        {searchQuery.trim() && !filteredOptions.some(o => o.name.toLowerCase() === searchQuery.trim().toLowerCase() || o.code.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSku({
                                id: `sku-custom-${Date.now().toString(36)}`,
                                code: searchQuery.trim().toUpperCase(),
                                name: searchQuery.trim(),
                              });
                              setIsDropdownOpen(false);
                              setSearchQuery('');
                            }}
                            className="w-full text-left p-2.5 hover:bg-card bg-canvas border-t border-border transition flex items-center justify-between text-xs text-link font-semibold cursor-pointer"
                          >
                            <span>Gunakan input manual: "<strong>{searchQuery.trim()}</strong>"</span>
                            <Plus className="w-4 h-4 text-link shrink-0" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Input Berat Hasil Jadi (Kg) */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Total Berat Hasil Jadi (Kg)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0.1"
              placeholder="0.0"
              value={actualKg}
              onChange={(e) => setActualKg(e.target.value)}
              className="w-full bg-canvas border border-border focus-visible:border-ring rounded-xl px-4 py-3 text-lg font-black text-success placeholder-disabled-foreground "
            />
            <span className="absolute right-4 top-3.5 text-xs text-subtle-foreground font-bold">
              Kg
            </span>
          </div>
        </div>

        {/* Catatan Kendala */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Status Kendala / Catatan Shift
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
            {COMMON_BOTTLENECK_TAGS.map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => setBottleneck(tag)}
                className={`py-1.5 px-2 text-left text-[11px] rounded-lg border transition truncate cursor-pointer ${
                  bottleneck === tag
                    ? 'bg-primary/10 text-link border-primary/30 font-bold'
                    : 'bg-canvas text-muted-foreground border-border hover:border-border-strong'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Catatan tambahan (opsional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-canvas border border-border focus-visible:border-ring rounded-xl px-3 py-2 text-xs text-foreground placeholder-disabled-foreground "
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-sm shadow-pop active:scale-[0.98] transition flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Simpan Hasil Produksi</span>
        </button>
      </form>

      {/* History Log Section */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-link" />
            <h2 className="text-xs font-bold text-foreground tracking-wider">
              Riwayat Hasil Jadi (Week {activePlanForDate.week_number})
            </h2>
          </div>

          {/* Filter Riwayat */}
          <div className="flex items-center space-x-1 text-[11px] bg-canvas p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setHistoryFilter('plan')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                historyFilter === 'plan'
                  ? 'bg-primary text-primary-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Week {activePlanForDate.week_number}
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('selected')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                historyFilter === 'selected'
                  ? 'bg-primary text-primary-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tanggal Ini
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                historyFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Semua
            </button>
          </div>
        </div>

        {displayedLogs.length === 0 ? (
          <p className="text-xs text-subtle-foreground text-center py-6">
            Belum ada riwayat hasil produksi yang tercatat.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {displayedLogs.map((log) => (
              <div
                key={log.id}
                className="bg-canvas border border-border rounded-xl p-3 flex items-center justify-between hover:border-border-strong transition"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-card text-foreground border border-border">
                      {log.sku_code}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-card text-muted-foreground border border-border flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5 text-link" />
                      {log.date}
                    </span>
                    {!plannedSkuIdSet.has(log.sku_id) && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-warning-subtle text-warning border border-warning-border font-semibold">
                        Tidak Ada di Plan
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-foreground mt-1 truncate">
                    {log.sku_name}
                  </h3>
                  <div className="flex items-center space-x-3 text-[11px] text-muted-foreground mt-0.5">
                    <span>
                      Hasil Jadi: <strong className="text-success font-bold">{formatKg(log.actual_kg)} Kg</strong>
                    </span>
                  </div>
                  {log.bottleneck_reason && log.bottleneck_reason !== 'Normal / Lancar' && (
                    <div className="mt-1 text-[10px] text-link">
                      Kendala: {log.bottleneck_reason}
                    </div>
                  )}
                  {log.notes && (
                    <p className="text-[10px] text-subtle-foreground mt-0.5 italic truncate">
                      &ldquo;{log.notes}&rdquo;
                    </p>
                  )}
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Hapus catatan ${log.sku_name} (${log.actual_kg} Kg pada ${log.date})?`)) {
                        onDeleteLog(log.id);
                      }
                    }}
                    title="Hapus entri ini (Admin)"
                    className="p-2 text-subtle-foreground hover:text-link hover:bg-primary/10 rounded-lg transition shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Import Excel Hasil Jadi */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-pop overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-success" />
                <h3 className="text-sm font-bold text-foreground">Import Hasil Produksi dari Excel</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {/* Template Info & Download */}
              <div className="p-3 bg-canvas border border-border rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">Format Kolom Template:</p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">sku • nama barang • qty KG</p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadExcelTemplate('production', skus)}
                  className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-muted border border-border-strong text-foreground text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-success" />
                  <span>Unduh Template</span>
                </button>
              </div>

              {/* Tanggal Hasil Produksi untuk batch import */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Tanggal Hasil Produksi
                  </label>
                  <input
                    type="date"
                    value={importDate}
                    onChange={(e) => setImportDate(e.target.value)}
                    className="w-full bg-canvas border border-border focus-visible:border-ring rounded-xl px-3 py-2 text-xs text-foreground cursor-pointer"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Masuk ke: <strong className="text-foreground">Week {importPlanForDate.week_number}</strong> ({importPlanForDate.start_date.slice(5)} - {importPlanForDate.end_date.slice(5)})
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Status Kendala / Catatan
                  </label>
                  <select
                    value={importBottleneck}
                    onChange={(e) => setImportBottleneck(e.target.value)}
                    className="w-full bg-canvas border border-border focus-visible:border-ring rounded-xl px-3 py-2 text-xs text-foreground cursor-pointer"
                  >
                    {COMMON_BOTTLENECK_TAGS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Input */}
              <div className="border-2 border-dashed border-border hover:border-border-strong rounded-2xl p-4 text-center bg-canvas transition">
                <input
                  type="file"
                  id="excelImportProdInput"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="excelImportProdInput"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <Upload className="w-7 h-7 text-success" />
                  <span className="text-xs font-bold text-foreground">
                    {importFile ? importFile.name : 'Pilih File Excel (.xlsx, .xls, .csv)'}
                  </span>
                  <span className="text-[10px] text-subtle-foreground">
                    Klik untuk memilih atau drag and drop file di sini
                  </span>
                </label>
              </div>

              {importError && (
                <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center space-x-2 text-link text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-link" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Preview Parsed Rows */}
              {importRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground">
                      Preview Data ({importRows.filter(r => r.isValid).length} baris valid)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Total: {importRows.reduce((acc, r) => acc + (r.isValid ? r.qty : 0), 0).toLocaleString('id-ID')} Kg
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-canvas">
                    {importRows.map((row, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <span className="font-mono text-[10px] text-link font-bold mr-1.5">
                            {row.sku}
                          </span>
                          <span className="text-foreground font-medium text-[11px] truncate">
                            {row.name}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          {row.isValid ? (
                            <span className="font-bold text-success font-mono">
                              {row.qty} Kg
                            </span>
                          ) : (
                            <span className="text-[10px] text-link font-semibold">
                              {row.errorMessage || 'Invalid'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-2 rounded-xl bg-muted hover:bg-accent text-foreground text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={importRows.filter(r => r.isValid).length === 0}
                onClick={handleApplyExcelLogs}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-card "
              >
                <Check className="w-4 h-4" />
                <span>Simpan Entri Hasil Jadi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import { ProductSKU, GSheetSyncResult } from '@/types';
import { DEFAULT_GSHEET_ID, parseCSVToSKUs } from '@/lib/gsheet';
import { DEFAULT_SKUS } from '@/lib/mockData';
import { 
  Boxes, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  UploadCloud, 
  Plus, 
  ShieldAlert,
  RotateCcw,
  Search,
  Tag,
  Info
} from '@/components/icons';

interface GoogleSheetSyncProps {
  skus: ProductSKU[];
  onUpdateSKUs: (newSkus: ProductSKU[]) => void;
}

export const GoogleSheetSync: React.FC<GoogleSheetSyncProps> = ({
  skus,
  onUpdateSKUs,
}) => {
  const [sheetId, setSheetId] = useState(DEFAULT_GSHEET_ID);
  const [loading, setLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<GSheetSyncResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New SKU manual state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState<ProductSKU['category']>('Slice');
  const [newSpecs, setNewSpecs] = useState('');

  const gsheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?gid=0#gid=0`;

  // Fetch sync from API
  const handleSyncGSheet = async () => {
    setLoading(true);
    setSyncResult(null);

    try {
      const res = await fetch(`/api/sync-skus?sheetId=${encodeURIComponent(sheetId)}&gid=0`);
      const data: GSheetSyncResult = await res.json();

      setSyncResult(data);

      if (data.success && data.skus && data.skus.length > 0) {
        onUpdateSKUs(data.skus);
      }
    } catch {
      setSyncResult({
        success: false,
        errorCode: 'NETWORK_ERROR',
        message: 'Gagal menghubungi server. Periksa koneksi internet Anda.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle local CSV file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseCSVToSKUs(text);
        if (parsed.length > 0) {
          onUpdateSKUs(parsed);
          setSyncResult({
            success: true,
            message: `Berhasil mengimpor ${parsed.length} SKU dari file CSV lokal!`,
            count: parsed.length,
          });
        } else {
          setSyncResult({
            success: false,
            message: 'Format CSV tidak dikenali atau file kosong.',
          });
        }
      }
    };
    reader.readAsText(file);
  };

  // Add manual SKU
  const handleAddManualSKU = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;

    const newSku: ProductSKU = {
      id: `sku-${Date.now()}`,
      sku_code: newCode.toUpperCase(),
      name: newName,
      category: newCat,
      unit: 'kg',
      specs: newSpecs || undefined,
      active: true,
    };

    onUpdateSKUs([...skus, newSku]);
    setNewCode('');
    setNewName('');
    setNewSpecs('');
    setShowAddModal(false);
  };

  // Filtered SKUs
  const filteredSkus = skus.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sku_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-24">
      {/* Title Header */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
        <h1 className="text-base @min-[640px]:text-lg font-bold text-foreground flex items-center gap-2">
          <Boxes className="w-5 h-5 text-link" />
          Database SKU & Sinkronisasi Google Sheet
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Hubungkan master barang pengolahan daging frozen langsung dari spreadsheet Google Drive Anda.
        </p>
      </div>

      {/* Google Sheet Sync Card */}
      <div className="bg-card border border-border rounded-2xl p-4 @min-[640px]:p-5 space-y-4 shadow-pop">
        <div className="flex flex-col @min-[640px]:flex-row @min-[640px]:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>Google Sheet: <strong>Database PlanCraft</strong></span>
            </h2>
            <a
              href={gsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-link hover:text-link inline-flex items-center gap-1 mt-0.5"
            >
              <span>Buka Google Sheet di Tab Baru</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateSKUs(DEFAULT_SKUS)}
              title="Reset ke SKU contoh standar"
              className="px-2.5 py-1.5 rounded-xl bg-muted hover:bg-accent text-muted-foreground hover:text-foreground text-xs font-medium transition flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Standar</span>
            </button>
          </div>
        </div>

        {/* Input Sheet ID & Sync Button */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-foreground">
            Google Spreadsheet ID / URL
          </label>
          <div className="flex flex-col @min-[640px]:flex-row gap-2">
            <input
              type="text"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              placeholder="Contoh: 1Dpe2Z8s3OcAJVN65vjGr2E_C2gR3UBPe946kG1GLR28"
              className="flex-1 bg-canvas border border-border rounded-xl px-3 py-2.5 text-xs text-foreground font-mono   "
            />
            <button
              onClick={handleSyncGSheet}
              disabled={loading}
              className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground font-bold text-xs rounded-xl shadow-card transition flex items-center justify-center gap-2 shrink-0 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Menghubungkan...' : 'Tarik Data SKU'}</span>
            </button>
          </div>
        </div>

        {/* Sync Status / Guidance Banner */}
        {syncResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              syncResult.success
                ? 'bg-success-subtle border-success-border text-success'
                : 'bg-warning-subtle border-warning-border text-warning'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {syncResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-foreground">{syncResult.message}</p>

                {syncResult.errorCode === 'RESTRICTED_ACCESS' && (
                  <div className="mt-2.5 pt-2.5 border-t border-warning-border text-foreground space-y-1.5 bg-canvas p-3 rounded-lg">
                    <p className="font-bold text-warning flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" />
                      Petunjuk Mengaktifkan Akses Google Sheet:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-foreground pl-1">
                      <li>Buka file spreadsheet Google Drive Anda.</li>
                      <li>Klik tombol <strong>Bagikan (Share)</strong> di sudut kanan atas.</li>
                      <li>
                        Di bagian <em>Akses umum</em>, ubah dari <strong>Dibatasi</strong> ke{' '}
                        <strong className="text-foreground">"Siapa saja yang memiliki link"</strong> (Anyone with the link).
                      </li>
                      <li>Pastikan perannya disetel sebagai <strong>Pelihat (Viewer)</strong>.</li>
                      <li>Klik Selesai, lalu kembali ke halaman ini dan tekan tombol <strong>"Tarik Data SKU"</strong>.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alternative CSV Upload */}
        <div className="pt-2 flex flex-col @min-[640px]:flex-row items-center justify-between gap-3 text-xs text-muted-foreground border-t border-border">
          <span>Opsi Alternatif (Bila di Cold Storage tanpa internet):</span>
          <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-muted hover:bg-accent text-foreground font-medium transition flex items-center gap-1.5 active:scale-95">
            <UploadCloud className="w-4 h-4 text-link" />
            <span>Upload File CSV Database</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Master SKU List */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex flex-col @min-[640px]:flex-row @min-[640px]:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>Daftar Master SKU Daging ({skus.length} Item)</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Data barang yang dapat dijadwalkan pada rencana produksi mingguan.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 rounded-xl bg-muted hover:bg-accent text-foreground text-xs font-semibold flex items-center justify-center gap-1 transition"
          >
            <Plus className="w-4 h-4 text-link" />
            <span>Tambah SKU Manual</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-subtle-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari kode SKU, nama daging, atau kategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-canvas border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder-subtle-foreground   "
          />
        </div>

        {/* SKU Cards Grid */}
        <div className="grid grid-cols-1 @min-[640px]:grid-cols-2 gap-2.5 pt-1">
          {filteredSkus.map((sku) => (
            <div
              key={sku.id}
              className="bg-canvas border border-border rounded-xl p-3 flex items-start justify-between space-x-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-foreground">
                    {sku.sku_code}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-link">
                    {sku.category}
                  </span>
                  <span className="text-[10px] text-subtle-foreground ">
                    {sku.unit}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-foreground mt-1 truncate">
                  {sku.name}
                </h3>
                {sku.specs && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                    {sku.specs}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual Add SKU Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-pop animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-link" />
              Tambah Master SKU Daging Baru
            </h3>

            <form onSubmit={handleAddManualSKU} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Kode SKU
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: BF-SL-005"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-foreground   "
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Nama Produk
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Daging Sirloin Slice 2mm"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-foreground   "
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Kategori
                </label>
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value as ProductSKU['category'])}
                  className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-foreground   "
                >
                  <option value="Slice">Slice</option>
                  <option value="Mince/Giling">Mince/Giling</option>
                  <option value="Dicing/Saikoro">Dicing/Saikoro</option>
                  <option value="Steak Cut">Steak Cut</option>
                  <option value="Trimming">Trimming</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Spesifikasi / Kemasan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Tray 500g, Fat 30%"
                  value={newSpecs}
                  onChange={(e) => setNewSpecs(e.target.value)}
                  className="w-full bg-canvas border border-border rounded-xl px-3 py-2 text-xs text-foreground   "
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-xl bg-muted hover:bg-accent text-foreground text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold"
                >
                  Simpan SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

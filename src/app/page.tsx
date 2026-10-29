'use client';

import React, { useState, useEffect } from 'react';
import { 
  ProductSKU, 
  WeeklyProductionPlan, 
  DailyProductionLog, 
  WeeklySummary,
  AuthUser
} from '@/types';
import { 
  getStoredSKUs, 
  saveStoredSKUs, 
  getStoredPlans, 
  saveStoredPlans, 
  getActivePlan, 
  setActivePlanId,
  getStoredLogs, 
  saveStoredLogs, 
  addDailyLog, 
  deleteDailyLog, 
  calculateWeeklySummary,
  deduplicatePlansList
} from '@/lib/storage';
import { 
  fetchInitialData, 
  createProductionLog, 
  removeProductionLog, 
  saveProductionPlan, 
  setActivePlanOnServer, 
  saveSKUsToServer,
  checkSession,
  logoutOnServer,
  migrateBrowserDataOnServer
} from '@/lib/apiClient';
import { getStoredUser, logoutUser } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav, NavTab } from '@/components/layout/BottomNav';
import { SummaryDashboard } from '@/components/dashboard/SummaryDashboard';
import { QuickInputForm } from '@/components/production/QuickInputForm';
import { WeeklyPlanManager } from '@/components/planning/WeeklyPlanManager';
import { WeeklyReport } from '@/components/reports/WeeklyReport';
import { GoogleSheetSync } from '@/components/master/GoogleSheetSync';
import { LoginForm } from '@/components/auth/LoginForm';
import { INITIAL_PLAN, DEFAULT_SKUS, INITIAL_LOGS } from '@/lib/mockData';

export default function HomePage() {
  const [isClientLoaded, setIsClientLoaded] = useState(false);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileFrame, setIsMobileFrame] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Core States
  const [skus, setSkus] = useState<ProductSKU[]>(DEFAULT_SKUS);
  const [plans, setPlans] = useState<WeeklyProductionPlan[]>([INITIAL_PLAN]);
  const [activePlan, setActivePlan] = useState<WeeklyProductionPlan>(INITIAL_PLAN);
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<string>('all');
  const [logs, setLogs] = useState<DailyProductionLog[]>(INITIAL_LOGS);

  // Fungsi refresh terpusat dari SQLite server
  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      const serverData = await fetchInitialData();
      if (serverData) {
        setSkus(serverData.skus);
        setPlans(serverData.plans);
        setActivePlan(serverData.activePlan);
        setLogs(serverData.logs);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Inisialisasi: Periksa sesi server dan ambil data SQLite terpusat
  useEffect(() => {
    async function initAuthAndData() {
      // 1. Cek sesi HTTP-only cookie di server
      const sessionUser = await checkSession();

      if (sessionUser) {
        setCurrentUser(sessionUser);

        // 2. Ambil data terpusat langsung dari SQLite server (sumber kebenaran tunggal)
        const serverData = await fetchInitialData();
        if (serverData) {
          setSkus(serverData.skus);
          setPlans(serverData.plans);
          setActivePlan(serverData.activePlan);
          setLogs(serverData.logs);
        }
      } else {
        // Sesi tidak ditemukan atau kedaluwarsa
        setCurrentUser(null);
      }
      setIsClientLoaded(true);
    }

    initAuthAndData();
  }, []);

  // Sinkronisasi otomatis antar-device (Real-time polling & window focus)
  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    const pollData = async () => {
      // Hanya poll saat dokumen terlihat (tidak hidden) agar hemat baterai/kuota
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const serverData = await fetchInitialData();
        if (serverData && isMounted) {
          setSkus(serverData.skus);
          setPlans(serverData.plans);
          setActivePlan(serverData.activePlan);
          setLogs(serverData.logs);
        }
      } catch {
        // Abaikan error pada background sync
      }
    };

    // Polling setiap 3.5 detik untuk sinkronisasi instan antar device
    const intervalId = setInterval(pollData, 3500);

    // Ambil data terbaru langsung saat device kembali dibuka atau tab aktif
    const handleSyncOnVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        pollData();
      }
    };

    window.addEventListener('visibilitychange', handleSyncOnVisible);
    window.addEventListener('focus', handleSyncOnVisible);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('visibilitychange', handleSyncOnVisible);
      window.removeEventListener('focus', handleSyncOnVisible);
    };
  }, [currentUser]);

  // Sinkronkan data instan saat pengguna berpindah menu tab di aplikasi
  useEffect(() => {
    if (currentUser) {
      fetchInitialData().then((serverData) => {
        if (serverData) {
          setSkus(serverData.skus);
          setPlans(serverData.plans);
          setActivePlan(serverData.activePlan);
          setLogs(serverData.logs);
        }
      });
    }
  }, [currentTab, currentUser]);

  // Proteksi Akses: Tim Produksi tidak boleh mengakses master database SKU (hanya admin)
  useEffect(() => {
    if (currentUser?.role === 'production' && currentTab === 'skus') {
      setCurrentTab('dashboard');
    }
  }, [currentUser?.role, currentTab]);

  // Handlers
  const handleLogout = async () => {
    await logoutOnServer();
    logoutUser();
    setCurrentUser(null);
  };

  const handleSaveLog = async (newLogData: Omit<DailyProductionLog, 'id' | 'created_at'>) => {
    const created = await createProductionLog(newLogData);
    if (created) {
      setLogs(prev => [created, ...prev.filter(l => l.id !== created.id)]);
    } else {
      const fallback = addDailyLog(newLogData);
      setLogs(prev => [fallback, ...prev]);
    }
    // Segera refresh data dari server agar semua device sinkron
    await handleRefresh();
  };

  const handleDeleteLog = async (id: string) => {
    setLogs(prev => prev.filter(l => l.id !== id));
    await removeProductionLog(id);
    deleteDailyLog(id);
    await handleRefresh();
  };

  const handleSavePlan = async (updatedPlan: WeeklyProductionPlan) => {
    setActivePlan(updatedPlan);
    setActivePlanId(updatedPlan.id);
    setPlans(prev => {
      const idx = prev.findIndex(p => p.id === updatedPlan.id);
      return idx >= 0 ? prev.map(p => p.id === updatedPlan.id ? updatedPlan : p) : [...prev, updatedPlan];
    });

    if (currentUser?.role === 'admin') {
      await saveProductionPlan(updatedPlan);
      if (updatedPlan.status === 'active') {
        await setActivePlanOnServer(updatedPlan.id);
      }
    }
    const currentPlans = getStoredPlans();
    const idx = currentPlans.findIndex(p => p.id === updatedPlan.id);
    const newPlans = idx >= 0 
      ? currentPlans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
      : [...currentPlans, updatedPlan];
    saveStoredPlans(newPlans);

    // Segera refresh data server
    await handleRefresh();
  };

  const handleSelectPlan = async (plan: WeeklyProductionPlan) => {
    setActivePlan(plan);
    setActivePlanId(plan.id);
    if (currentUser?.role === 'admin') {
      await setActivePlanOnServer(plan.id);
      await handleRefresh();
    }
  };

  const handleUpdateSKUs = async (newSkus: ProductSKU[]) => {
    setSkus(newSkus);
    saveStoredSKUs(newSkus);
    if (currentUser?.role === 'admin') {
      await saveSKUsToServer(newSkus);
    }
    await handleRefresh();
  };

  // Calculate summary based on month and week filter
  const targetPlansForSummary = React.useMemo(() => {
    const deduped = deduplicatePlansList(plans);
    if (selectedWeekFilter === 'all') return deduped;
    if (selectedWeekFilter.startsWith('month-')) {
      const parts = selectedWeekFilter.split('-');
      const m = Number(parts[1]);
      const y = Number(parts[2]);
      return deduped.filter(p => {
        const pMonth = p.month || Number(p.start_date.split('-')[1]) || 10;
        return pMonth === m && (p.year || 2026) === y;
      });
    }
    return deduped.filter(p => p.id === selectedWeekFilter);
  }, [plans, selectedWeekFilter]);

  const summary: WeeklySummary = calculateWeeklySummary(
    targetPlansForSummary.length > 0 ? targetPlansForSummary : [activePlan],
    logs
  );

  if (!isClientLoaded) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center text-foreground">
        <div className="w-12 h-12 rounded-2xl bg-primary animate-pulse flex items-center justify-center mb-3">
          <span className="text-xl font-black">PC</span>
        </div>
        <p className="text-sm text-muted-foreground font-medium">Memuat PlanCraft Daging Frozen...</p>
      </div>
    );
  }

  // Jika belum login, tampilkan layar Login
  if (!currentUser) {
    return (
      <LoginForm
        onLogin={async (user) => {
          setCurrentUser(user);

          // Tarik data SQLite terpusat langsung dari server
          const serverData = await fetchInitialData();
          if (serverData) {
            setSkus(serverData.skus);
            setPlans(serverData.plans);
            setActivePlan(serverData.activePlan);
            setLogs(serverData.logs);
          }
          setCurrentTab('dashboard');
        }}
      />
    );
  }

  // Content renderer
  const renderTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <SummaryDashboard
            plans={plans}
            selectedWeekFilter={selectedWeekFilter}
            onSelectWeekFilter={setSelectedWeekFilter}
            activePlan={activePlan}
            logs={logs}
            summary={summary}
            onNavigateToInput={() => setCurrentTab('input')}
            onNavigateToPlanning={() => setCurrentTab('planning')}
          />
        );
      case 'input':
        return (
          <QuickInputForm
            plan={activePlan}
            plans={plans}
            onSelectPlan={handleSelectPlan}
            skus={skus}
            logs={logs}
            currentUser={currentUser}
            onSaveLog={handleSaveLog}
            onDeleteLog={handleDeleteLog}
          />
        );
      case 'planning':
        return (
          <WeeklyPlanManager
            plan={activePlan}
            plans={plans}
            skus={skus}
            currentUser={currentUser}
            onSavePlan={handleSavePlan}
          />
        );
      case 'reports':
        return (
          <WeeklyReport
            plan={activePlan}
            plans={plans}
            logs={logs}
            summary={summary}
          />
        );
      case 'skus':
        return (
          <GoogleSheetSync
            skus={skus}
            onUpdateSKUs={handleUpdateSKUs}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen bg-canvas flex flex-col ${isMobileFrame ? 'p-0 md:p-6 md:bg-card' : ''}`}>
      {/* Wrapper - Either normal responsive or phone frame simulation */}
      <div
        className={`@container flex-1 flex flex-col mx-auto w-full transition-all duration-300 ${
          isMobileFrame
            ? 'max-w-md bg-canvas md:rounded-[40px] md:border-[10px] md:border-border md:shadow-pop md:overflow-hidden relative min-h-[844px]'
            : 'max-w-4xl'
        }`}
      >
        {/* Navbar */}
        <Navbar
          activePlan={activePlan}
          plans={plans}
          onSelectPlan={handleSelectPlan}
          currentUser={currentUser}
          isMobileFrame={isMobileFrame}
          setIsMobileFrame={setIsMobileFrame}
          onRefresh={handleRefresh}
          onLogout={handleLogout}
          isSyncing={isSyncing}
        />

        {/* Main Content Area */}
        <main className="flex-1 px-3.5 @min-[640px]:px-6 py-4 overflow-y-auto">
          {renderTabContent()}
        </main>

        {/* Bottom Navigation for Mobile */}
        <BottomNav
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          userRole={currentUser.role}
          isMobileFrame={isMobileFrame}
        />
      </div>
    </div>
  );
}

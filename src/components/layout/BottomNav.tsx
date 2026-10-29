'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  CalendarDays, 
  BarChart3, 
  Boxes 
} from '@/components/icons';

import { UserRole } from '@/types';

export type NavTab = 'dashboard' | 'input' | 'planning' | 'reports' | 'skus';

interface BottomNavProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  userRole?: UserRole;
  isMobileFrame: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab, userRole = 'admin', isMobileFrame }) => {
  const allTabs = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'input' as NavTab,
      label: 'Input Hasil',
      icon: PlusCircle,
      isPrimary: true,
    },
    {
      id: 'planning' as NavTab,
      label: 'Plan',
      icon: CalendarDays,
    },
    {
      id: 'reports' as NavTab,
      label: 'Laporan',
      icon: BarChart3,
    },
    {
      id: 'skus' as NavTab,
      label: 'Database',
      icon: Boxes,
    },
  ];

  // Tim Produksi: Hanya sembunyikan Database SKU, tetap tampilkan Plan (Target Plan)
  const tabs = allTabs
    .map(tab => {
      if (tab.id === 'planning' && userRole === 'production') {
        return { ...tab, label: 'Target Plan' };
      }
      return tab;
    })
    .filter(tab => {
      if (userRole === 'production') {
        return tab.id !== 'skus';
      }
      return true;
    });

  return (
    <nav className={`${isMobileFrame ? 'absolute' : 'fixed'} bottom-0 left-0 right-0 z-50 bg-card backdrop-blur-md border-t border-border shadow-pop safe-area-bottom`}>
      <div className="max-w-md mx-auto px-2 py-1.5 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          if (tab.isPrimary) {
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className="flex flex-col items-center justify-center -mt-5 group "
              >
                <div
                  className={`w-13 h-13 rounded-full flex items-center justify-center shadow-pop transition-transform active:scale-90 ${
                    isActive
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/30'
                      : 'bg-primary text-primary-foreground group-hover:scale-105'
                  }`}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <span
                  className={`text-[10px] mt-1 font-bold ${
                    isActive ? 'text-link' : 'text-foreground'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors  ${
                isActive
                  ? 'text-link font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

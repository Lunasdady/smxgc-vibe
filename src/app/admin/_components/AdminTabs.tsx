'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, BarChart3, Shield } from 'lucide-react';

const tabs = [
  { id: 'data', label: '数据管理', href: '/admin', icon: Database },
  { id: 'operation', label: '运营管理', href: '/admin/operation', icon: BarChart3 },
  { id: 'permissions', label: '权限管理', href: '/admin/permissions', icon: Shield },
];

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-apple inline-flex">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
              isActive
                ? 'bg-[#0071E3] text-white'
                : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

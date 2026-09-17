'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChartColumnBig,
  Upload,
  Store,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

function ActiveBar() {
  return (
    <span
      aria-hidden="true"
      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary"
    />
  );
}

function Wordmark({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={`flex items-center ${collapsed ? '' : 'gap-2.5'}`}>
      <div className="w-8 h-8 flex-shrink-0 rounded-[var(--radius-control)] bg-primary flex items-center justify-center shadow-sm">
        <ChartColumnBig size={16} className="text-sidebar-bg" />
      </div>
      {!collapsed && (
        <span className="leading-tight">
          <span className="block font-display text-sm text-text-primary">DATA</span>
          <span className="block text-[10px] font-semibold tracking-[0.18em] text-primary">REPORTS</span>
        </span>
      )}
    </div>
  );
}

const NAV: NavItem[] = [
  { id: 'reports', label: 'Reports', icon: <ChartColumnBig size={20} />, href: '/' },
  { id: 'import', label: 'Import Data', icon: <Upload size={20} />, href: '/import' },
  { id: 'locations', label: 'Locations', icon: <Store size={20} />, href: '/locations' },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent) => setIsCollapsed(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const navLinkClass = (active: boolean) =>
    `relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
      active
        ? 'bg-sidebar-hover text-white'
        : 'text-sidebar-text-muted hover:bg-sidebar-hover/60 hover:text-white'
    }`;

  return (
    <div
      className={`bg-sidebar-bg text-white flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {isCollapsed ? (
        <div className="flex flex-col items-center gap-1 py-3 border-b border-sidebar-border">
          <Wordmark collapsed />
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-2 text-sidebar-text-muted hover:bg-sidebar-hover hover:text-white rounded-lg transition-colors"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      ) : (
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <Wordmark collapsed={false} />
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-2 text-sidebar-text-muted hover:bg-sidebar-hover hover:text-white rounded-lg transition-colors"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      )}

      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {NAV.map(item => {
            const active = isActive(item.href);
            return (
              <li key={item.id}>
                <Link href={item.href} className={navLinkClass(active)} title={isCollapsed ? item.label : undefined}>
                  {active && <ActiveBar />}
                  <span className={`flex-shrink-0 ${active ? 'text-primary-border' : ''}`}>{item.icon}</span>
                  {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {!isCollapsed && (
        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-text-muted">Demo environment</p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown, LogIn, User, LogOut } from 'lucide-react';
import { STRATEGY_GROUPS, STRATEGY_NAME_MAP, getFuturesStrategies } from '@/lib/types';
import { useAppStore } from '@/lib/store';

// Design Tokens:
// - Primary Red: #E31B23 (增长曲线/市场动量)
// - Deep Space Gray: #1D1D1F (文字颜色)
// - Font: -apple-system, BlinkMacSystemFont, "PingFang SC"
// - Spacing: gap 14px (图标与文字间距)
// - Hover: translateY(-1px) + 红色线条动画
function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 五角星 - 由两个重叠的平行四边形构成 */}
      <path
        d="M12 3L13.5 8.5L19 8.5L14.5 12L16 17.5L12 14.5L8 17.5L9.5 12L5 8.5L10.5 8.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-[#1D1D1F]"
      />
      {/* 红色装饰线 - 象征业绩增长曲线 */}
      <path
        d="M15 14C16 15 17.5 15.5 19 14.5"
        stroke="#E31B23"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="logo-accent-line"
      />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { dataDate } = useAppStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [user, setUser] = useState<{ realName: string; email: string } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const tokenMatch = document.cookie.match(/user-token=([^;]+)/);
      if (!tokenMatch) {
        setUser(null);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${tokenMatch[1]}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    };
    fetchUser();
    const interval = setInterval(fetchUser, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    document.cookie = 'user-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setUser(null);
    setUserMenuOpen(false);
    window.location.href = '/';
  };

  const isHome = pathname === '/';
  const isStrategy = pathname?.startsWith('/strategy/');

  // 动态获取期货策略列表
  const futuresStrategies = getFuturesStrategies(dataDate);
  
  // 构建动态策略分组
  const dynamicStrategyGroups = STRATEGY_GROUPS.map(group => {
    if (group.isDynamic) {
      return { ...group, strategies: futuresStrategies };
    }
    return group;
  });

  // Flatten all strategies for grid display
  const allStrategies = dynamicStrategyGroups.flatMap((group) =>
    group.strategies.map((type) => ({
      type,
      name: STRATEGY_NAME_MAP[type],
      groupName: group.name,
    }))
  );

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-apple ${
          scrolled ? 'nav-glass' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-[14px] group logo-container">
              <div className="w-8 h-8 rounded-lg glass-card backdrop-blur-xl bg-white/60 border border-white/50 shadow-sm flex items-center justify-center transition-all duration-300 ease-apple group-hover:translate-y-[-1px] group-hover:shadow-md group-hover:bg-white/80">
                <LogoIcon className="w-5 h-5" />
              </div>
              <span className="text-[15px] font-semibold text-[#1D1D1F] tracking-tight hidden sm:block" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif' }}>
                私募星工厂
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink href="/" active={isHome}>
                概况
              </NavLink>

              {/* Strategy dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setStrategyOpen(true)}
                onMouseLeave={() => setStrategyOpen(false)}
              >
                <button
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300 ease-apple ${
                    isStrategy
                      ? 'text-[#0071E3] bg-[#0071E3]/8'
                      : 'text-[#1D1D1F]/70 hover:text-[#1D1D1F] hover:bg-black/5'
                  }`}
                >
                  策略
                  <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${strategyOpen ? 'rotate-180' : ''}`} />
                </button>

                {strategyOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2">
                    <div className="glass-card rounded-2xl p-4 shadow-apple-lg w-[420px]">
                      <div className="grid grid-cols-3 gap-1">
                        {allStrategies.map((strategy) => (
                          <Link
                            key={strategy.type}
                            href={`/strategy/${strategy.type}`}
                            className={`px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 text-center ${
                              pathname === `/strategy/${strategy.type}`
                                ? 'text-[#0071E3] bg-[#0071E3]/8 font-medium'
                                : 'text-[#1D1D1F]/80 hover:text-[#1D1D1F] hover:bg-black/5'
                            }`}
                          >
                            {strategy.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <NavLink href="/admin" active={pathname === '/admin'}>
                管理
              </NavLink>
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-3 relative">
              {/* User menu (desktop) */}
              {user ? (
                <div className="hidden md:block relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full text-[13px] font-medium text-[#1D1D1F]/80 hover:bg-black/5 transition-all"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#0071E3]/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-[#0071E3]" />
                    </div>
                    <span className="max-w-[80px] truncate">{user.realName}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 top-full pt-2 z-50">
                        <div className="glass-card rounded-2xl p-2 shadow-apple-lg w-44">
                          <div className="px-3 py-2 border-b border-[#0000000D] mb-1">
                            <p className="text-[13px] font-medium text-[#1D1D1F] truncate">{user.realName}</p>
                            <p className="text-[11px] text-[#86868B] truncate">{user.email}</p>
                          </div>
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] text-[#DC2626] hover:bg-[#DC2626]/5 transition-all"
                          >
                            <LogOut className="w-4 h-4" />
                            退出登录
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                pathname !== '/login' && pathname !== '/register' && (
                  <Link
                    href="/login"
                    className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] text-white rounded-full text-[13px] font-medium hover:bg-[#0077ED] transition-all"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    登录 / 注册
                  </Link>
                )
              )}
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-xl hover:bg-black/5 transition-colors"
              >
                {mobileOpen ? (
                  <X className="w-5 h-5 text-[#1D1D1F]" />
                ) : (
                  <Menu className="w-5 h-5 text-[#1D1D1F]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-14 left-0 right-0 glass-card mx-4 rounded-2xl p-4 shadow-apple-lg animate-fade-in-up">
            <div className="space-y-1">
              <MobileNavLink href="/" active={isHome} onClick={() => setMobileOpen(false)}>
                概况
              </MobileNavLink>
              <div className="pt-2 pb-1">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                  策略分类
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {allStrategies.map((strategy) => (
                    <MobileNavLink
                      key={strategy.type}
                      href={`/strategy/${strategy.type}`}
                      active={pathname === `/strategy/${strategy.type}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      {strategy.name}
                    </MobileNavLink>
                  ))}
                </div>
              </div>
              <MobileNavLink href="/admin" active={pathname === '/admin'} onClick={() => setMobileOpen(false)}>
                管理后台
              </MobileNavLink>
              {user ? (
                <>
                  <div className="px-3 py-2.5 rounded-xl bg-[#0071E3]/8">
                    <p className="text-[13px] font-medium text-[#0071E3]">{user.realName}</p>
                    <p className="text-[11px] text-[#86868B]">{user.email}</p>
                  </div>
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[15px] text-[#DC2626] hover:bg-[#DC2626]/5 transition-all text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </>
              ) : (
                <MobileNavLink href="/login" active={pathname === '/login'} onClick={() => setMobileOpen(false)}>
                  登录 / 注册
                </MobileNavLink>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300 ease-apple ${
        active
          ? 'text-[#0071E3] bg-[#0071E3]/8'
          : 'text-[#1D1D1F]/70 hover:text-[#1D1D1F] hover:bg-black/5'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  active,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block px-3 py-2.5 rounded-xl text-[15px] transition-all duration-200 ${
        active
          ? 'text-[#0071E3] bg-[#0071E3]/8 font-semibold'
          : 'text-[#1D1D1F] hover:bg-black/5'
      }`}
    >
      {children}
    </Link>
  );
}

'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('策略页面错误:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-[24px] font-semibold text-[#1D1D1F] mb-4">策略页面加载失败</h2>
        <p className="text-[15px] text-[#86868B] mb-6">请检查策略类型是否正确</p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl transition-colors text-[15px] font-medium"
        >
          重新加载
        </button>
      </div>
    </div>
  );
}

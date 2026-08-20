/**
 * 通用分页组件 - 支持前后多页点选
 */

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  // 生成页码列表
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showPages = 2; // 当前页前后显示几页
    
    if (totalPages <= 7) {
      // 总页数少时，显示所有页
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 总页数多时，智能显示
      // 第1页
      pages.push(1);
      
      if (currentPage > 4) {
        pages.push('...');
      }
      
      // 当前页前后的页
      const start = Math.max(2, currentPage - showPages);
      const end = Math.min(totalPages - 1, currentPage + showPages);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 3) {
        pages.push('...');
      }
      
      // 最后1页
      pages.push(totalPages);
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-[14px] text-[#86868B]">
        共 {total} 条记录，第 {currentPage} / {totalPages} 页
      </div>
      <div className="flex items-center gap-2">
        {/* 上一页 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F5F5F7]"
        >
          上一页
        </button>
        
        {/* 页码 */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, idx) => (
            typeof page === 'number' ? (
              <button
                key={idx}
                onClick={() => onPageChange(page)}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-[14px] font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-[#0071E3] text-white'
                    : 'bg-[#FFFFFF] border border-[#0000000D] text-[#1D1D1F] hover:bg-[#F5F5F7]'
                }`}
              >
                {page}
              </button>
            ) : (
              <span key={idx} className="px-2 text-[#86868B]">
                ...
              </span>
            )
          ))}
        </div>
        
        {/* 下一页 */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F5F5F7]"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

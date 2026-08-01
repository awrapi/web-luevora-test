import Icon from '@/components/shared/Icon';
import { getContactDisplay } from '@/utils/contactDisplay';

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const CustomerListPanel = ({
  customers = [],
  selectedPhone,
  onSelect,
  search,
  onSearchChange,
  sort,
  onSortChange,
  stats,
  loading
}) => {
  return (
    <div className="min-h-0 flex flex-col border-r border-border-base bg-bg-surface overflow-hidden">
      <div className="p-4 border-b border-border-base">
        <h6 className="font-display font-bold text-sm text-text-heading mb-3">Customer List</h6>
        <div className="relative mb-3">
          <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border-base bg-bg-subtle text-xs outline-none focus:border-indigo-base focus:bg-white transition-all"
            placeholder="Cari nama, nomor..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${sort === 'recent' ? 'bg-indigo-base text-white border-indigo-base' : 'bg-white text-text-muted border-border-base'}`}
            onClick={() => onSortChange('recent')}
          >
            Terbaru
          </button>
          <button
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${sort === 'name' ? 'bg-indigo-base text-white border-indigo-base' : 'bg-white text-text-muted border-border-base'}`}
            onClick={() => onSortChange('name')}
          >
            Nama
          </button>
          <button
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${sort === 'value' ? 'bg-indigo-base text-white border-indigo-base' : 'bg-white text-text-muted border-border-base'}`}
            onClick={() => onSortChange('value')}
          >
            Value
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 border-b border-border-base bg-bg-subtle">
        <div className="bg-white border border-border-base rounded-lg p-2">
          <div className="text-[10px] text-text-muted font-bold uppercase">Total</div>
          <div className="text-sm font-bold text-text-heading">{stats?.total || 0}</div>
        </div>
        <div className="bg-white border border-border-base rounded-lg p-2">
          <div className="text-[10px] text-text-muted font-bold uppercase">Need Follow Up</div>
          <div className="text-sm font-bold text-amber-600">{stats?.need_followup || 0}</div>
        </div>
        <div className="bg-white border border-border-base rounded-lg p-2 col-span-2">
          <div className="text-[10px] text-text-muted font-bold uppercase">Revenue</div>
          <div className="text-sm font-bold text-green-600">{formatCurrency(stats?.revenue || 0)}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-base"></div>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-xs">Belum ada data customer.</div>
        ) : (
          customers.map((customer) => (
            <button
              key={customer.phone}
              onClick={() => onSelect(customer)}
              className={`w-full text-left p-4 border-b border-bg-subtle transition-all ${
                selectedPhone === customer.phone ? 'bg-indigo-soft border-l-4 border-l-indigo-base' : 'hover:bg-bg-subtle'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {(() => {
                    const { primary, secondary } = getContactDisplay(customer);
                    return (
                      <>
                        <div className="font-bold text-[13px] text-text-heading truncate">{primary}</div>
                        {secondary && <div className="text-[11px] text-text-muted truncate">{secondary}</div>}
                      </>
                    );
                  })()}
                  <div className="text-[11px] text-text-muted truncate mt-1">{customer.last_message_preview || 'Belum ada pesan'}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-bold uppercase text-text-muted">{customer.latest_transaction?.status || '-'}</div>
                  <div className="text-[11px] font-bold text-text-heading">
                    {customer.latest_transaction ? formatCurrency(customer.latest_transaction.total_price) : '-'}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default CustomerListPanel;

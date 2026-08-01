import Icon from '@/components/shared/Icon';
import { getContactDisplay } from '@/utils/contactDisplay';

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const CustomerConversationPanel = ({
  selectedCustomer,
  detail,
  chats = [],
  loadingDetail,
  loadingChat,
  inputMessage,
  setInputMessage,
  onSend,
  onFollowUp
}) => {
  if (!selectedCustomer) {
    return (
      <div className="flex items-center justify-center text-text-muted">
        <div className="text-center">
          <Icon name="Users" size={48} className="mx-auto mb-3 opacity-50" />
          <p className="font-bold text-sm">Pilih customer untuk melihat detail</p>
        </div>
      </div>
    );
  }

  const customerLead = detail?.lead || selectedCustomer;
  const transactions = detail?.transactions || [];
  const { primary: contactPrimary, secondary: contactSecondary } = getContactDisplay(customerLead);

  return (
    <div className="min-h-0 flex flex-col bg-wa-bg relative overflow-hidden">
      <div className="relative z-10 px-5 py-3 bg-wa-header text-white border-b border-black/10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-bold text-sm">{contactPrimary}</div>
            {contactSecondary && <div className="text-[11px] opacity-80">{contactSecondary}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onFollowUp}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/25 transition-colors"
            >
              AI Follow Up
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-[1fr_320px] min-h-0 flex-1">
        <div className="min-h-0 flex flex-col border-r border-border-base/60 bg-[#efeae2]">
          <div className="min-h-0 flex-1 p-4 overflow-y-auto flex flex-col gap-2">
            {loadingChat ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-base"></div>
              </div>
            ) : chats.length === 0 ? (
              <div className="text-center text-xs text-text-muted py-10">Belum ada chat untuk customer ini.</div>
            ) : (
              chats.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[82%] px-3 py-2 rounded-lg text-sm shadow-xs ${
                    msg.role === 'assistant' || msg.role === 'admin' ? 'self-end bg-wa-bubble-out' : 'self-start bg-white'
                  }`}
                >
                  <div>{msg.message}</div>
                  <div className="text-[10px] text-text-muted mt-1">{formatDate(msg.created_at)}</div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 bg-[#f0f2f5] border-t border-border-base flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSend();
              }}
              className="flex-1 px-4 py-2 rounded-full border border-border-base outline-none text-sm"
              placeholder="Ketik pesan untuk customer..."
            />
            <button
              onClick={onSend}
              className="w-10 h-10 rounded-full bg-wa-teal text-white flex items-center justify-center hover:bg-wa-green-light"
            >
              <Icon name="Send" size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 bg-bg-surface overflow-y-auto">
          <div className="p-4 border-b border-border-base">
            <h6 className="font-display font-bold text-sm text-text-heading">Customer Detail</h6>
          </div>

          {loadingDetail ? (
            <div className="p-6 flex items-center justify-center">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-base"></div>
            </div>
          ) : (
            <div className="p-4 space-y-4 text-xs">
              <div className="border border-border-base rounded-lg p-3">
                <div className="text-text-muted mb-1">Nama</div>
                <div className="font-bold text-text-heading">{contactSecondary || '-'}</div>
              </div>
              <div className="border border-border-base rounded-lg p-3">
                <div className="text-text-muted mb-1">Status</div>
                <div className="font-bold text-text-heading">{customerLead.status || '-'}</div>
              </div>
              <div className="border border-border-base rounded-lg p-3">
                <div className="text-text-muted mb-1">Total Chat</div>
                <div className="font-bold text-text-heading">{detail?.total_chats || 0}</div>
              </div>
              <div className="border border-border-base rounded-lg p-3">
                <div className="text-text-muted mb-2">Label Layanan</div>
                <div className="flex flex-wrap gap-1.5">
                  {(detail?.labels || []).length === 0 ? (
                    <span className="text-text-muted">Belum ada label</span>
                  ) : (
                    detail.labels.map((label) => (
                      <span key={`${label.id}-${label.label_name}`} className="px-2 py-1 rounded-full bg-indigo-soft text-indigo-base font-bold">
                        {label.label_name}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="border border-border-base rounded-lg p-3">
                <div className="text-text-muted mb-2">Transaksi Terakhir</div>
                {transactions.length === 0 ? (
                  <div className="text-text-muted">Belum ada transaksi</div>
                ) : (
                  <div className="space-y-2">
                    {transactions.slice(0, 3).map((trx) => (
                      <div key={trx.id} className="p-2 bg-bg-subtle rounded-md">
                        <div className="font-bold text-text-heading">{trx.destination || '-'}</div>
                        <div className="text-text-muted">{trx.order_id || '-'}</div>
                        <div className="font-bold text-green-600">{formatCurrency(trx.total_price)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerConversationPanel;

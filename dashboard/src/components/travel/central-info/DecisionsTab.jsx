import Icon from '@/components/shared/Icon';

const fmtCurrency = (n) => typeof n === 'number' ? `Rp${n.toLocaleString('id-ID')}` : '-';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const SectionHeader = ({ icon, title, count }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon name={icon} size={14} className="text-text-muted" />
    <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">{title}</span>
    {count > 0 && <span className="text-[10px] font-medium text-text-muted">({count})</span>}
  </div>
);

export default function DecisionsTab({
  customer,
  pendingItems,
  blockers,
  actionMode,
  setDateActionMode,
  dateActionDrafts,
  setDateActionDrafts,
  handleApproveDate,
  handleRejectDate,
  offers,
  offerActionDrafts,
  setOfferActionDrafts,
  handleApproveOffer,
  handleRejectOffer,
  requests,
  requestActionMode,
  setRequestActionMode,
  requestActionDrafts,
  setRequestActionDrafts,
  handleApproveRequest,
  handleRejectRequest,
  handleTakeoverRequest,
  infoRequests,
  instructionDrafts,
  setInstructionDrafts,
  handleSendInstruction,
  handleTakeoverInfoRequest,
  submittingIds,
}) {
  const isPendingDate = customer.date_status === 'pending_approval';
  const isApproved = customer.date_status === 'approved';
  const isRejected = customer.date_status === 'rejected';
  const needsDateDecision = isPendingDate || (customer.requested_date && !isApproved && !isRejected);

  return (
    <div className="space-y-6">
      {/* Pending Items Summary */}
      {pendingItems.length > 0 && (
        <div>
          <SectionHeader title="Butuh Keputusan" count={pendingItems.length} icon="AlertCircle" />
          <div className="space-y-2">
            {pendingItems.map((item, i) => (
              <div key={`${item.type}-${item.id}-${i}`} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border-base bg-bg-subtle/30">
                <div className="w-8 h-8 rounded-lg bg-white text-text-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name={item.type === 'date_approval' ? 'Calendar' : item.type === 'offer' ? 'Tag' : 'Inbox'} size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-semibold text-text-heading">{item.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${
                      item.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                      item.status === 'counter' ? 'bg-blue-50 text-blue-700 ring-blue-200' :
                      'bg-slate-100 text-slate-600 ring-slate-200'
                    }`}>
                      {item.status === 'pending' ? 'Pending' : item.status === 'counter' ? 'Counter' : item.status}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">{item.detail}</p>
                  {item.note && (
                    <div className="mt-2 bg-white rounded-lg px-3 py-2">
                      <p className="text-xs text-text-body leading-relaxed whitespace-pre-wrap">{item.note}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Date Approval / Rejection */}
      {needsDateDecision && (
        <div>
          <SectionHeader title="Keputusan Tanggal" icon="Calendar" />

          {blockers.blocked && (
            <div className="mb-3 bg-amber-50 border border-amber-200/60 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="AlertTriangle" size={13} className="text-amber-500" />
                <span className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold">Selesaikan Dulu</span>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                Admin harus menyelesaikan {blockers.hasOffer && <strong>Penawaran Harga</strong>}{blockers.hasOffer && blockers.hasRequest ? ' dan ' : ''}{blockers.hasRequest && <strong>Request Pelanggan</strong>} sebelum menyetujui jadwal.
              </p>
            </div>
          )}

          {actionMode === 'approve' ? (
            <div className="border border-border-base rounded-xl p-4 space-y-3 bg-bg-subtle/30">
              <div className="flex items-center gap-2">
                <Icon name="CheckCircle" size={15} className="text-emerald-500" />
                <span className="text-sm font-semibold text-text-heading">Approve Tanggal</span>
              </div>
              <textarea
                className="w-full border border-border-base rounded-xl p-3 text-xs bg-white focus:outline-none focus:border-indigo-base resize-none transition-all placeholder:text-text-muted/60"
                rows={2}
                placeholder="Catatan untuk AI (opsional)..."
                value={(dateActionDrafts[customer.id] || {}).admin_note || ''}
                onChange={(e) => setDateActionDrafts(prev => ({ ...prev, [customer.id]: { ...prev[customer.id], admin_note: e.target.value } }))}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApproveDate(customer.id)}
                  disabled={submittingIds.has(`approve_${customer.id}`)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:bg-emerald-600 transition-all disabled:opacity-50"
                >
                  {submittingIds.has(`approve_${customer.id}`) ? (
                    <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Memproses...</>
                  ) : (
                    <><Icon name="Check" size={12} /> Approve</>
                  )}
                </button>
                <button
                  onClick={() => setDateActionMode(prev => { const n = { ...prev }; delete n[customer.id]; return n; })}
                  className="px-3 py-2 text-xs font-medium text-text-muted hover:text-text-body transition-all"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : actionMode === 'reject' ? (
            <div className="border border-border-base rounded-xl p-4 space-y-3 bg-bg-subtle/30">
              <div className="flex items-center gap-2">
                <Icon name="XCircle" size={15} className="text-red-500" />
                <span className="text-sm font-semibold text-text-heading">Tolak Tanggal</span>
              </div>
              <textarea
                className="w-full border border-border-base rounded-xl p-3 text-xs bg-white focus:outline-none focus:border-red-300 resize-none transition-all placeholder:text-text-muted/60"
                rows={2}
                placeholder="Alasan penolakan (wajib)..."
                value={(dateActionDrafts[customer.id] || {}).reason || ''}
                onChange={(e) => setDateActionDrafts(prev => ({ ...prev, [customer.id]: { ...prev[customer.id], reason: e.target.value } }))}
              />
              <input
                type="text"
                className="w-full border border-border-base rounded-xl p-3 text-xs bg-white focus:outline-none focus:border-red-300 transition-all placeholder:text-text-muted/60"
                placeholder="Tanggal alternatif (opsional, pisahkan dengan koma)"
                value={(dateActionDrafts[customer.id] || {}).suggested_dates || ''}
                onChange={(e) => setDateActionDrafts(prev => ({ ...prev, [customer.id]: { ...prev[customer.id], suggested_dates: e.target.value } }))}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRejectDate(customer.id)}
                  disabled={submittingIds.has(`reject_${customer.id}`) || !(dateActionDrafts[customer.id] || {}).reason?.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-semibold hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingIds.has(`reject_${customer.id}`) ? (
                    <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Memproses...</>
                  ) : (
                    <><Icon name="X" size={12} /> Tolak</>
                  )}
                </button>
                <button
                  onClick={() => setDateActionMode(prev => { const n = { ...prev }; delete n[customer.id]; return n; })}
                  className="px-3 py-2 text-xs font-medium text-text-muted hover:text-text-body transition-all"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDateActionMode(prev => ({ ...prev, [customer.id]: 'approve' }))}
                disabled={blockers.blocked}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:bg-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title={blockers.blocked ? 'Selesaikan penawaran/request terlebih dahulu' : 'Approve tanggal keberangkatan'}
              >
                <Icon name="CheckCircle" size={14} /> Approve Tanggal
              </button>
              <button
                onClick={() => setDateActionMode(prev => ({ ...prev, [customer.id]: 'reject' }))}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-red-200 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 transition-all"
              >
                <Icon name="XCircle" size={14} /> Tolak
              </button>
            </div>
          )}
        </div>
      )}

      {/* Offers */}
      {offers.length > 0 && (
        <div>
          <SectionHeader title="Penawaran Harga" count={offers.length} icon="Tag" />
          <div className="space-y-2">
            {offers.map(offer => {
              const origPrice = Number(offer.original_price) || 0;
              const offPrice = Number(offer.offered_price) || 0;
              const adminOffer = Number(offer.admin_offer) || 0;
              const hasDiscount = origPrice > 0 && offPrice > 0 && offPrice < origPrice;
              const discountPct = hasDiscount ? Math.round(((origPrice - offPrice) / origPrice) * 100) : 0;

              return (
                <div key={offer.id} className="px-4 py-3 rounded-xl border border-border-base bg-white">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div>
                      <div className="text-sm font-semibold text-text-heading">{offer.package_name || 'Paket Travel'}</div>
                      {offer.customer_name && <div className="text-[10px] text-text-muted mt-0.5">untuk {offer.customer_name}</div>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                      offer.status === 'counter_offered' ? 'text-blue-600 bg-blue-50' :
                      offer.status === 'approved' ? 'text-emerald-600 bg-emerald-50' :
                      offer.status === 'rejected' ? 'text-red-500 bg-red-50' :
                      'text-amber-600 bg-amber-50'
                    }`}>
                      {offer.status === 'counter_offered' ? 'Counter' : offer.status === 'approved' ? 'Approved' : offer.status === 'rejected' ? 'Ditolak' : 'Pending'}
                    </span>
                  </div>

                  <div className="bg-bg-subtle rounded-lg px-3 py-2.5 mb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="block text-[10px] text-text-muted uppercase tracking-wide font-semibold mb-0.5">Harga Ditawarkan</span>
                        <span className="text-base font-bold text-emerald-600">{fmtCurrency(offPrice)}</span>
                      </div>
                      {hasDiscount && (
                        <div className="text-right">
                          <span className="block text-[10px] text-text-muted uppercase tracking-wide font-semibold mb-0.5">Harga Asli</span>
                          <span className="text-xs text-text-muted line-through">{fmtCurrency(origPrice)}</span>
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-600">-{discountPct}%</span>
                        </div>
                      )}
                      {origPrice > 0 && !hasDiscount && (
                        <div className="text-right">
                          <span className="block text-[10px] text-text-muted uppercase tracking-wide font-semibold mb-0.5">Harga Asli</span>
                          <span className="text-xs font-semibold text-text-heading">{fmtCurrency(origPrice)}</span>
                        </div>
                      )}
                    </div>
                    {adminOffer > 0 && adminOffer !== offPrice && (
                      <div className="mt-2 pt-2 border-t border-border-base/50">
                        <span className="block text-[10px] text-indigo-400 uppercase tracking-wide font-semibold mb-0.5">Harga Admin</span>
                        <span className="text-xs font-semibold text-indigo-600">{fmtCurrency(adminOffer)}</span>
                      </div>
                    )}
                  </div>

                  {offer.admin_note && (
                    <div className="bg-bg-subtle rounded-lg px-3 py-2 mb-3">
                      <span className="block text-[10px] text-text-muted uppercase tracking-wide font-semibold mb-0.5">Catatan</span>
                      <p className="text-xs text-text-body leading-relaxed">{offer.admin_note}</p>
                    </div>
                  )}

                  {offer.created_at && (
                    <div className="text-[10px] text-text-muted mb-3 flex items-center gap-1">
                      <Icon name="Clock" size={10} /> {fmtDate(offer.created_at)}
                    </div>
                  )}

                  {offer.status === 'pending' && (
                    <div className="space-y-2">
                      {(offerActionDrafts[offer.id] || {}).showReject ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            className="w-full border border-border-base rounded-xl p-2.5 text-xs bg-white focus:outline-none focus:border-red-300 transition-all placeholder:text-text-muted/60"
                            placeholder="Alasan penolakan (wajib)..."
                            value={(offerActionDrafts[offer.id] || {}).reason || ''}
                            onChange={(e) => setOfferActionDrafts(prev => ({ ...prev, [offer.id]: { ...prev[offer.id], reason: e.target.value } }))}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRejectOffer(offer.id)}
                              disabled={submittingIds.has(`offer_reject_${offer.id}`) || !(offerActionDrafts[offer.id] || {}).reason?.trim()}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-all disabled:opacity-50"
                            >
                              {submittingIds.has(`offer_reject_${offer.id}`) ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : <Icon name="X" size={11} />}
                              Tolak
                            </button>
                            <button
                              onClick={() => setOfferActionDrafts(prev => ({ ...prev, [offer.id]: { ...prev[offer.id], showReject: false } }))}
                              className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-body transition-all"
                            >Batal</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleApproveOffer(offer.id)}
                            disabled={submittingIds.has(`offer_approve_${offer.id}`)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-all disabled:opacity-50"
                          >
                            {submittingIds.has(`offer_approve_${offer.id}`) ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : <Icon name="Check" size={11} />}
                            Approve
                          </button>
                          <button
                            onClick={() => setOfferActionDrafts(prev => ({ ...prev, [offer.id]: { ...prev[offer.id], showReject: true } }))}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-500 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-50 transition-all"
                          >
                            <Icon name="XCircle" size={11} /> Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Customer Requests */}
      {requests.length > 0 && (
        <div>
          <SectionHeader title="Request Pelanggan" count={requests.length} icon="Inbox" />
          <div className="space-y-2">
            {requests.map(req => {
              const reqMode = requestActionMode[req.id];
              return (
                <div key={req.id} className="px-4 py-3 rounded-xl border border-border-base bg-white">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-semibold text-text-heading">{req.package_name || 'Request'}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      req.status === 'pending_customer' ? 'text-blue-600 bg-blue-50' : 'text-amber-600 bg-amber-50'
                    }`}>
                      {req.status === 'pending_customer' ? 'Menunggu Customer' : 'Pending'}
                    </span>
                    {req.request_type === 'revision' && (
                      <span className="px-2 py-0.5 text-rose-500 text-[10px] font-medium rounded bg-rose-50">Revisi</span>
                    )}
                  </div>
                  <p className="text-xs text-text-body leading-relaxed mb-3 whitespace-pre-wrap">{req.request_detail}</p>
                  {req.revision_note && (
                    <div className="mb-3 bg-bg-subtle rounded-lg px-3 py-2">
                      <span className="text-[10px] text-text-muted uppercase tracking-wide font-semibold block mb-0.5">Catatan Revisi</span>
                      <p className="text-xs text-text-body">{req.revision_note}</p>
                    </div>
                  )}

                  {req.status === 'pending' && (
                    <div className="space-y-2">
                      {reqMode === 'approve_terms' ? (
                        <div className="space-y-2">
                          <textarea
                            autoFocus
                            className="w-full border border-border-base rounded-xl p-2.5 text-xs bg-white focus:outline-none focus:border-emerald-300 resize-none transition-all placeholder:text-text-muted/60"
                            rows={2}
                            placeholder="Syarat/catatan untuk AI sampaikan ke customer..."
                            value={(requestActionDrafts[req.id] || {}).ai_context || ''}
                            onChange={(e) => setRequestActionDrafts(prev => ({ ...prev, [req.id]: { ...prev[req.id], ai_context: e.target.value } }))}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApproveRequest(req.id)}
                              disabled={submittingIds.has(`req_approve_${req.id}`) || !(requestActionDrafts[req.id] || {}).ai_context?.trim()}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-all disabled:opacity-50"
                            >
                              {submittingIds.has(`req_approve_${req.id}`) ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : <Icon name="Check" size={11} />}
                              Kirim
                            </button>
                            <button
                              onClick={() => setRequestActionMode(prev => { const n = { ...prev }; delete n[req.id]; return n; })}
                              className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-body transition-all"
                            >Batal</button>
                          </div>
                        </div>
                      ) : reqMode === 'reject' ? (
                        <div className="space-y-2">
                          <input
                            autoFocus
                            type="text"
                            className="w-full border border-border-base rounded-xl p-2.5 text-xs bg-white focus:outline-none focus:border-red-300 transition-all placeholder:text-text-muted/60"
                            placeholder="Alasan penolakan (wajib)..."
                            value={(requestActionDrafts[req.id] || {}).reason || ''}
                            onChange={(e) => setRequestActionDrafts(prev => ({ ...prev, [req.id]: { ...prev[req.id], reason: e.target.value } }))}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRejectRequest(req.id)}
                              disabled={submittingIds.has(`req_reject_${req.id}`) || !(requestActionDrafts[req.id] || {}).reason?.trim()}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-all disabled:opacity-50"
                            >
                              {submittingIds.has(`req_reject_${req.id}`) ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-500" /> : <Icon name="X" size={11} />}
                              Tolak
                            </button>
                            <button
                              onClick={() => setRequestActionMode(prev => { const n = { ...prev }; delete n[req.id]; return n; })}
                              className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-body transition-all"
                            >Batal</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleApproveRequest(req.id)}
                            disabled={submittingIds.has(`req_approve_${req.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-all disabled:opacity-50"
                          >
                            {submittingIds.has(`req_approve_${req.id}`) ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : <Icon name="Check" size={11} />}
                            Setujui
                          </button>
                          <button
                            onClick={() => setRequestActionMode(prev => ({ ...prev, [req.id]: 'approve_terms' }))}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-soft text-indigo-base border border-indigo-border rounded-lg text-xs font-semibold hover:bg-indigo-soft/80 transition-all"
                          >
                            <Icon name="FileText" size={11} /> + Syarat
                          </button>
                          <button
                            onClick={() => setRequestActionMode(prev => ({ ...prev, [req.id]: 'reject' }))}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-500 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-50 transition-all"
                          >
                            <Icon name="XCircle" size={11} /> Tolak
                          </button>
                          <button
                            onClick={() => handleTakeoverRequest(req.id, req.phone)}
                            disabled={submittingIds.has(`req_takeover_${req.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-subtle text-text-body border border-border-base rounded-lg text-xs font-semibold hover:bg-border-base/40 transition-all disabled:opacity-50"
                          >
                            {submittingIds.has(`req_takeover_${req.id}`) ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-text-body" /> : <Icon name="MessageCircle" size={11} />}
                            Ambil Alih
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Requests */}
      {infoRequests.length > 0 && (
        <div>
          <SectionHeader title="Laporan AI ke Admin" count={infoRequests.length} icon="HelpCircle" />
          <div className="space-y-2">
            {infoRequests.map(req => (
              <div key={req.id} className="px-4 py-3 rounded-xl border border-border-base bg-white">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600">
                    🤖 AI Report
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    req.status === 'resolved' ? 'text-emerald-600 bg-emerald-50' :
                    req.status === 'instructed' ? 'text-blue-600 bg-blue-50' :
                    'text-amber-600 bg-amber-50'
                  }`}>
                    {req.status === 'resolved' ? 'Selesai' : req.status === 'instructed' ? 'Sudah Diinstruksi' : 'Menunggu Admin'}
                  </span>
                  <span className="text-[10px] text-text-muted">{fmtDate(req.created_at)}</span>
                </div>
                <div className="bg-gradient-to-r from-indigo-50/80 to-violet-50/50 rounded-lg px-3 py-2.5 mb-3 border border-indigo-100/60">
                  <p className="text-xs text-text-heading leading-relaxed whitespace-pre-wrap font-medium">{req.questions}</p>
                </div>
                {req.admin_instruction && (
                  <div className="mb-3 bg-bg-subtle rounded-lg px-3 py-2">
                    <span className="text-[10px] text-text-muted uppercase tracking-wide font-semibold block mb-0.5">Instruksi Admin</span>
                    <p className="text-xs text-text-body">{req.admin_instruction}</p>
                  </div>
                )}
                {req.status !== 'resolved' && (
                  <div className="space-y-2">
                    <textarea
                      className="w-full border border-border-base rounded-xl p-2.5 text-xs bg-white focus:outline-none focus:border-indigo-base resize-none transition-all placeholder:text-text-muted/60"
                      rows={2}
                      placeholder="Berikan instruksi untuk AI..."
                      value={instructionDrafts[req.id] || ''}
                      onChange={(e) => setInstructionDrafts(prev => ({ ...prev, [req.id]: e.target.value }))}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleSendInstruction(req.id)}
                        disabled={submittingIds.has(req.id) || !(instructionDrafts[req.id] || '').trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-semibold hover:bg-indigo-600 transition-all disabled:opacity-50"
                      >
                        {submittingIds.has(req.id) ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : <Icon name="Send" size={11} />}
                        Kirim
                      </button>
                      <button
                        onClick={() => handleTakeoverInfoRequest(req.id, req.phone)}
                        disabled={submittingIds.has(`takeover_${req.id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-subtle text-text-body border border-border-base rounded-lg text-xs font-semibold hover:bg-border-base/40 transition-all disabled:opacity-50"
                      >
                        {submittingIds.has(`takeover_${req.id}`) ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-text-body" /> : <Icon name="ExternalLink" size={11} />}
                        Takeover
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

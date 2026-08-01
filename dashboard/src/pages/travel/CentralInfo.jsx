import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';
import {
  StatusBadge,
  EmptyState,
  CustomerDetailDrawer,
  SkeletonList,
} from '@/components/travel/central-info';

// Lightweight markdown renderer: **bold**, *italic*, tables, line breaks
const renderInline = (text) => {
  const parts = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0, m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) parts.push(<strong key={m.index} className="font-semibold">{m[1]}</strong>);
    else if (m[2] !== undefined) parts.push(<em key={m.index}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
};

const isTableRow = (line) => line.trim().startsWith('|') && line.trim().endsWith('|');
const isSeparatorRow = (line) => /^\|[\s\-:|]+\|/.test(line.trim());

const renderMarkdown = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isTableRow(line) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const headerCells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      i += 2;

      const rows = [];
      while (i < lines.length && isTableRow(lines[i]) && !isSeparatorRow(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        rows.push(cells);
        i++;
      }

      result.push(
        <div key={`table-${i}`} className="overflow-x-auto my-2 rounded-lg border border-slate-200">
          <table className="w-full text-[11.5px] border-collapse">
            <thead>
              <tr className="bg-slate-100">
                {headerCells.map((cell, ci) => (
                  <th key={ci} className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-700 border-b border-slate-100 whitespace-nowrap">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (isSeparatorRow(line)) { i++; continue; }

    result.push(
      <span key={i}>
        {renderInline(line)}
        {i < lines.length - 1 && <br />}
      </span>
    );
    i++;
  }

  return result;
};

const CentralInfo = () => {
  const navigate = useNavigate();
  const [cancellations, setCancellations] = useState([]);
  const [modifications, setModifications] = useState({ requests: [], auto_approved: [] });
  const [customerMgmt, setCustomerMgmt] = useState([]);
  const [statusInfo, setStatusInfo] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [infoRequests, setInfoRequests] = useState([]);
  const [pendingOffers, setPendingOffers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [instructionDrafts, setInstructionDrafts] = useState({});
  const [submittingIds, setSubmittingIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateActionMode, setDateActionMode] = useState({});
  const [dateActionDrafts, setDateActionDrafts] = useState({});
  const [offerActionDrafts, setOfferActionDrafts] = useState({});
  const [requestActionDrafts, setRequestActionDrafts] = useState({});
  const [requestActionMode, setRequestActionMode] = useState({});
  const [guiderChatOpen, setGuiderChatOpen] = useState(null);
  const [guiderChats, setGuiderChats] = useState([]);
  const [guiderTodos, setGuiderTodos] = useState([]);
  const [guiderRequest, setGuiderRequest] = useState(null);
  const [guiderInput, setGuiderInput] = useState('');
  const [guiderSending, setGuiderSending] = useState(false);
  const [guiderExecuting, setGuiderExecuting] = useState(new Set());
  const guiderChatEndRef = useRef(null);
  const [detailCustomerId, setDetailCustomerId] = useState(null);

  // ── CM Copilot State ──
  const [cmChatOpen, setCmChatOpen] = useState(null);
  const [cmChats, setCmChats] = useState([]);
  const [cmItems, setCmItems] = useState([]);
  const [cmData, setCmData] = useState(null);
  const [cmLead, setCmLead] = useState(null);
  const [cmInput, setCmInput] = useState('');
  const [cmSending, setCmSending] = useState(false);
  const [cmProceedDraft, setCmProceedDraft] = useState(null);
  const [cmProceedItems, setCmProceedItems] = useState([]);
  const [cmProceedSending, setCmProceedSending] = useState(false);
  const [cmItemActionMode, setCmItemActionMode] = useState({});
  const [cmItemActionDrafts, setCmItemActionDrafts] = useState({});
  const [cmItemUpdating, setCmItemUpdating] = useState(new Set());
  const [cmItemQuestionDrafts, setCmItemQuestionDrafts] = useState({});
  const cmChatEndRef = useRef(null);

  const fetchCentralInfo = async () => {
    try {
      setLoading(true);
      const [resCancel, resMod, resCust, resStat, resRef, resInfoReq, resOffers, resRequests] = await Promise.all([
        api.get('/travel/central-info/cancellations'),
        api.get('/travel/central-info/modifications'),
        api.get('/travel/central-info/customer-management'),
        api.get('/travel/central-info/status-information'),
        api.get('/travel/refunds'),
        api.get('/travel/central-info/info-requests'),
        api.get('/offers'),
        api.get('/travel/customer-requests', { params: { status: 'pending' } })
      ]);
      if (resCancel.data.success) setCancellations(resCancel.data.data);
      if (resMod.data.success) setModifications(resMod.data.data);
      if (resCust.data.success) setCustomerMgmt(resCust.data.data);
      if (resStat.data.success) setStatusInfo(resStat.data.data);
      if (resRef.data.success) setRefunds(resRef.data.data);
      if (resInfoReq.data.success) setInfoRequests(resInfoReq.data.data);
      if (resOffers.data.success) setPendingOffers((resOffers.data.data || []).filter(o => o.status === 'pending'));
      if (resRequests.data.success) setPendingRequests(resRequests.data.data || []);
    } catch (err) {
      console.error('[CentralInfo] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCentralInfo();
    setTimeout(() => setRefreshing(false), 600);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const [resCancel, resMod, resCust, resStat, resRef, resInfoReq, resOffers, resRequests] = await Promise.all([
          api.get('/travel/central-info/cancellations'),
          api.get('/travel/central-info/modifications'),
          api.get('/travel/central-info/customer-management'),
          api.get('/travel/central-info/status-information'),
          api.get('/travel/refunds'),
          api.get('/travel/central-info/info-requests'),
          api.get('/offers'),
          api.get('/travel/customer-requests', { params: { status: 'pending' } })
        ]);
        if (!mounted) return;
        if (resCancel.data.success) setCancellations(resCancel.data.data);
        if (resMod.data.success) setModifications(resMod.data.data);
        if (resCust.data.success) setCustomerMgmt(resCust.data.data);
        if (resStat.data.success) setStatusInfo(resStat.data.data);
        if (resRef.data.success) setRefunds(resRef.data.data);
        if (resInfoReq.data.success) setInfoRequests(resInfoReq.data.data);
        if (resOffers.data.success) setPendingOffers((resOffers.data.data || []).filter(o => o.status === 'pending'));
        if (resRequests.data.success) setPendingRequests(resRequests.data.data || []);
      } catch (err) {
        console.error('[CentralInfo] fetch error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const handleSse = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'central_info_request_created' || data.type === 'open_questions_completed') {
          api.get('/travel/central-info/info-requests').then(res => {
            if (res.data.success) setInfoRequests(res.data.data);
          }).catch(() => { /* ignore */ });
          // If guider chat is open for this request, refresh it
          if (guiderChatOpen && data.data?.request_id === guiderChatOpen) {
            api.get(`/travel/system-guider/${guiderChatOpen}/history`).then(res => {
              if (res.data.success) {
                setGuiderChats(res.data.data.chats || []);
                setGuiderTodos(res.data.data.todos || []);
                setGuiderRequest(res.data.data.request || null);
              }
            }).catch(() => {});
          }
        }
      } catch { /* SSE parse error ignored */ }
    };
    window.addEventListener('luevora_sse', handleSse);
    return () => window.removeEventListener('luevora_sse', handleSse);
  }, [guiderChatOpen]);

  // ── System Guider Handlers ──
  const openGuiderChat = async (requestId) => {
    setGuiderChatOpen(requestId);
    setGuiderChats([]); setGuiderTodos([]); setGuiderRequest(null); setGuiderInput('');
    try {
      const res = await api.get(`/travel/system-guider/${requestId}/history`);
      if (res.data.success) {
        setGuiderChats(res.data.data.chats || []);
        setGuiderTodos(res.data.data.todos || []);
        setGuiderRequest(res.data.data.request || null);
      }
    } catch (err) { console.error('[Guider] history error:', err); }
  };

  const sendGuiderMessage = async () => {
    if (!guiderInput.trim() || guiderSending) return;
    const msg = guiderInput.trim();
    setGuiderInput('');
    setGuiderSending(true);
    setGuiderChats(prev => [...prev, { id: Date.now(), role: 'admin', message: msg, type: 'text', created_at: new Date().toISOString() }]);
    try {
      const res = await api.post(`/travel/system-guider/${guiderChatOpen}/chat`, { message: msg });
      if (res.data.success) {
        setGuiderChats(prev => [...prev, { id: Date.now() + 1, role: 'ai', message: res.data.data.message, type: res.data.data.type, created_at: new Date().toISOString() }]);
        setGuiderTodos(res.data.data.todos || []);
        if (res.data.data.required_info) {
          setGuiderRequest(prev => prev ? { ...prev, required_info: res.data.data.required_info } : prev);
        }
      }
    } catch (err) { console.error('[Guider] chat error:', err); }
    setGuiderSending(false);
  };

  const executeAllGuiderTodos = async () => {
    const pendingIds = guiderTodos.filter(t => t.status === 'pending').map(t => t.id);
    for (const id of pendingIds) setGuiderExecuting(prev => new Set(prev).add(id));
    try {
      await api.post(`/travel/system-guider/${guiderChatOpen}/execute-all`);
      const res = await api.get(`/travel/system-guider/${guiderChatOpen}/history`);
      if (res.data.success) {
        setGuiderChats(res.data.data.chats || []);
        setGuiderTodos(res.data.data.todos || []);
        if (res.data.data.request?.status === 'resolved') {
          setGuiderRequest(prev => prev ? { ...prev, status: 'resolved' } : prev);
        }
      }
      fetchCentralInfo();
    } catch (err) { console.error('[Guider] execute-all error:', err); }
    setGuiderExecuting(new Set());
  };

  const executeNeedInfoHandler = async (todoId) => {
    setGuiderExecuting(prev => new Set(prev).add(todoId));
    try {
      await api.post(`/travel/system-guider/${guiderChatOpen}/execute-need-info/${todoId}`);
      const res = await api.get(`/travel/system-guider/${guiderChatOpen}/history`);
      if (res.data.success) {
        setGuiderChats(res.data.data.chats || []);
        setGuiderTodos(res.data.data.todos || []);
        setGuiderRequest(prev => prev ? { ...prev, status: res.data.data.request?.status || prev.status } : prev);
      }
      fetchCentralInfo();
    } catch (err) { console.error('[Guider] execute-need-info error:', err); }
    setGuiderExecuting(prev => { const s = new Set(prev); s.delete(todoId); return s; });
  };

  useEffect(() => {
    if (guiderChatEndRef.current) guiderChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [guiderChats]);

  useEffect(() => {
    if (cmChatEndRef.current) cmChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [cmChats]);

  // ── CM Copilot Handlers ──
  const openCmChat = async (cmId) => {
    setCmChatOpen(cmId);
    setCmChats([]); setCmItems([]); setCmData(null); setCmLead(null); setCmInput('');
    setCmProceedDraft(null); setCmProceedItems([]);
    setCmItemActionMode({}); setCmItemActionDrafts({});
    try {
      const res = await api.get(`/travel/cm-copilot/${cmId}/history`);
      if (res.data.success) {
        setCmChats(res.data.data.chats || []);
        setCmItems(res.data.data.items || []);
        setCmData(res.data.data.cm || null);
        setCmLead(res.data.data.lead || null);
      }
    } catch (err) { console.error('[CmCopilot] history error:', err); }
  };

  const sendCmMessage = async () => {
    if (!cmInput.trim() || cmSending) return;
    const msg = cmInput.trim();
    setCmInput('');
    setCmSending(true);
    setCmChats(prev => [...prev, { id: Date.now(), role: 'admin', message: msg, message_type: 'text', created_at: new Date().toISOString() }]);
    try {
      const res = await api.post(`/travel/cm-copilot/${cmChatOpen}/chat`, { message: msg });
      if (res.data.success) {
        setCmChats(prev => [...prev, { id: Date.now() + 1, role: 'ai', message: res.data.data.message, message_type: res.data.data.type, created_at: new Date().toISOString() }]);
        // Refresh items if action was taken
        if (res.data.data.action) {
          const histRes = await api.get(`/travel/cm-copilot/${cmChatOpen}/history`);
          if (histRes.data.success) setCmItems(histRes.data.data.items || []);
          
          if (res.data.data.action.draft) {
            setCmProceedDraft(res.data.data.action.draft);
            setCmProceedItems(res.data.data.action.items || []);
          }
        }
      }
    } catch (err) { console.error('[CmCopilot] chat error:', err); }
    setCmSending(false);
  };

  // ── Sidebar Item Action Handler ──
  const handleCmItemAction = async (itemId, status, decision) => {
    if (!cmChatOpen) return;
    setCmItemUpdating(prev => new Set(prev).add(itemId));
    try {
      const res = await api.put(`/travel/cm-copilot/${cmChatOpen}/items/${itemId}`, { status, decision: decision || undefined });
      if (res.data.success) {
        const result = res.data.data;
        // Update items list
        setCmItems(prev => prev.map(i => i.id === itemId ? { ...i, status, admin_decision: decision || i.admin_decision } : i));
        // Append chat messages from backend
        if (result.chat_message) {
          setCmChats(prev => [...prev, result.chat_message]);
        }
        if (result.decision_summary?.chat) {
          setCmChats(prev => [...prev, result.decision_summary.chat]);
        }
        // If all resolved, mark CM as completed
        if (result.all_resolved) {
          setCmData(prev => prev ? { ...prev, status: 'completed' } : prev);
          if (result.draft) {
            setCmProceedDraft(result.draft);
          }
        }
        // Clear action mode for this item
        setCmItemActionMode(prev => { const n = { ...prev }; delete n[itemId]; return n; });
        setCmItemActionDrafts(prev => { const n = { ...prev }; delete n[itemId]; return n; });
      }
    } catch (err) { console.error('[CmCopilot] item action error:', err); }
    setCmItemUpdating(prev => { const s = new Set(prev); s.delete(itemId); return s; });
  };

  // ── Set Pending Question on Item ──
  const handleSetItemQuestion = async (itemId) => {
    const question = (cmItemQuestionDrafts[itemId] || '').trim();
    if (!question || !cmChatOpen) return;
    setCmItemUpdating(prev => new Set(prev).add(itemId));
    try {
      const res = await api.put(`/travel/cm-copilot/${cmChatOpen}/items/${itemId}/question`, { question });
      if (res.data.success) {
        setCmItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'pending_question', pending_question: question } : i));
        setCmItemActionMode(prev => { const n = { ...prev }; delete n[itemId]; return n; });
        setCmItemQuestionDrafts(prev => { const n = { ...prev }; delete n[itemId]; return n; });
        // Refresh chats to show system card
        const histRes = await api.get(`/travel/cm-copilot/${cmChatOpen}/history`);
        if (histRes.data.success) setCmChats(histRes.data.data.chats || []);
      }
    } catch (err) { console.error('[CmCopilot] set-question error:', err); }
    setCmItemUpdating(prev => { const s = new Set(prev); s.delete(itemId); return s; });
  };

  const handleCmProceed = async () => {
    setCmProceedSending(true);
    try {
      const res = await api.post(`/travel/cm-copilot/${cmChatOpen}/proceed`);
      if (res.data.success) {
        setCmProceedDraft(res.data.data.draft || '');
        setCmProceedItems(res.data.data.items || []);
      }
    } catch (err) { console.error('[CmCopilot] proceed error:', err); }
    setCmProceedSending(false);
  };

  const handleCmSendToCustomer = async () => {
    if (!cmProceedDraft?.trim()) return;
    setCmProceedSending(true);
    try {
      await api.post(`/travel/cm-copilot/${cmChatOpen}/send`, { message: cmProceedDraft.trim() });
      setCmProceedDraft(null);
      setCmProceedItems([]);
      // Refresh everything
      const histRes = await api.get(`/travel/cm-copilot/${cmChatOpen}/history`);
      if (histRes.data.success) {
        setCmChats(histRes.data.data.chats || []);
        setCmItems(histRes.data.data.items || []);
        setCmData(histRes.data.data.cm || null);
      }
      fetchCentralInfo();
    } catch (err) { console.error('[CmCopilot] send error:', err); }
    setCmProceedSending(false);
  };

  useEffect(() => {
    if (!detailCustomerId && !guiderChatOpen && !cmChatOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') { setDetailCustomerId(null); setGuiderChatOpen(null); setCmChatOpen(null); setCmProceedDraft(null); } };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleEsc); document.body.style.overflow = ''; };
  }, [detailCustomerId, guiderChatOpen, cmChatOpen]);

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-';
  const fmtCurrency = (n) => typeof n === 'number' ? `Rp${n.toLocaleString('id-ID')}` : '-';
  const fmtDateOnly = (d) => d
    ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';
  void fmtDate; // kept for CustomerDetailDrawer usage via closures

  const getStatusBadge = (status) => {
    const map = {
      pending: { label: 'Menunggu Admin', color: 'amber' },
      instructed: { label: 'Sudah Diinstruksi', color: 'blue' },
      taken_over: { label: 'Diambil Alih', color: 'violet' },
      resolved: { label: 'Selesai', color: 'emerald' },
      awaiting_customer: { label: '🔍 Menunggu Customer', color: 'sky' },
      info_received: { label: '✅ Info Diterima', color: 'teal' },
    };
    const s = map[status] || map.pending;
    return <StatusBadge status={status}>{s.label}</StatusBadge>;
  };

  const handleSendInstruction = async (requestId) => {
    const instruction = (instructionDrafts[requestId] || '').trim();
    if (!instruction) return;
    setSubmittingIds(prev => new Set(prev).add(requestId));
    try {
      await api.put(`/travel/central-info/info-requests/${requestId}/instruct`, { instruction });
      const res = await api.get('/travel/central-info/info-requests');
      if (res.data.success) setInfoRequests(res.data.data);
      setInstructionDrafts(prev => ({ ...prev, [requestId]: '' }));
    } catch (err) {
      console.error('[CentralInfo] Failed to send instruction:', err);
    } finally {
      setSubmittingIds(prev => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  };

  const handleTakeover = async (requestId, phone) => {
    setSubmittingIds(prev => new Set(prev).add(`takeover_${requestId}`));
    try {
      await api.put(`/travel/central-info/info-requests/${requestId}/takeover`);
      navigate(`/leads?phone=${encodeURIComponent(phone)}`);
    } catch (err) {
      console.error('[CentralInfo] Failed to takeover:', err);
    } finally {
      setSubmittingIds(prev => { const s = new Set(prev); s.delete(`takeover_${requestId}`); return s; });
    }
  };

  const handleApproveDate = async (cmId) => {
    setSubmittingIds(prev => new Set(prev).add(`approve_${cmId}`));
    try {
      const draft = dateActionDrafts[cmId] || {};
      await api.put(`/travel/central-info/customer-management/${cmId}/approve-date`, {
        admin_note: draft.admin_note || ''
      });
      const res = await api.get('/travel/central-info/customer-management');
      if (res.data.success) setCustomerMgmt(res.data.data);
      setDateActionMode(prev => { const n = { ...prev }; delete n[cmId]; return n; });
      setDateActionDrafts(prev => { const n = { ...prev }; delete n[cmId]; return n; });
    } catch (err) {
      console.error('[CentralInfo] Failed to approve date:', err);
    } finally {
      setSubmittingIds(prev => { const s = new Set(prev); s.delete(`approve_${cmId}`); return s; });
    }
  };

  const handleRejectDate = async (cmId) => {
    const draft = dateActionDrafts[cmId] || {};
    if (!draft.reason?.trim()) return;
    setSubmittingIds(prev => new Set(prev).add(`reject_${cmId}`));
    try {
      const suggestedDates = (draft.suggested_dates || '')
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);
      await api.put(`/travel/central-info/customer-management/${cmId}/reject-date`, {
        reason: draft.reason.trim(),
        suggested_dates: suggestedDates.length > 0 ? suggestedDates : undefined
      });
      const res = await api.get('/travel/central-info/customer-management');
      if (res.data.success) setCustomerMgmt(res.data.data);
      setDateActionMode(prev => { const n = { ...prev }; delete n[cmId]; return n; });
      setDateActionDrafts(prev => { const n = { ...prev }; delete n[cmId]; return n; });
    } catch (err) {
      console.error('[CentralInfo] Failed to reject date:', err);
    } finally {
      setSubmittingIds(prev => { const s = new Set(prev); s.delete(`reject_${cmId}`); return s; });
    }
  };

  const handleApproveOffer = async (offerId) => {
    setSubmittingIds(prev => new Set(prev).add(`offer_approve_${offerId}`));
    try {
      await api.post(`/offers/${offerId}/approve`);
      const resOffers = await api.get('/offers');
      if (resOffers.data.success) setPendingOffers((resOffers.data.data || []).filter(o => o.status === 'pending'));
    } catch (err) {
      console.error('[CentralInfo] Failed to approve offer:', err);
    } finally {
      setSubmittingIds(prev => { const s = new Set(prev); s.delete(`offer_approve_${offerId}`); return s; });
    }
  };

  const handleRejectOffer = async (offerId) => {
    const reason = (offerActionDrafts[offerId] || {}).reason || '';
    if (!reason.trim()) return;
    setSubmittingIds(prev => new Set(prev).add(`offer_reject_${offerId}`));
    try {
      await api.post(`/offers/${offerId}/reject`, { reason: reason.trim() });
      const resOffers = await api.get('/offers');
      if (resOffers.data.success) setPendingOffers((resOffers.data.data || []).filter(o => o.status === 'pending'));
      setOfferActionDrafts(prev => { const n = { ...prev }; delete n[offerId]; return n; });
    } catch (err) {
      console.error('[CentralInfo] Failed to reject offer:', err);
    } finally {
      setSubmittingIds(prev => { const s = new Set(prev); s.delete(`offer_reject_${offerId}`); return s; });
    }
  };

  const handleApproveRequest = async (reqId) => {
    const mode = requestActionMode[reqId] || 'approve_direct';
    const draft = requestActionDrafts[reqId] || {};
    if (mode === 'approve_terms' && !draft.ai_context?.trim()) return;
    setSubmittingIds(prev => new Set(prev).add(`req_approve_${reqId}`));
    try {
      await api.post(`/travel/customer-requests/${reqId}/approve`, {
        with_terms: mode === 'approve_terms',
        ai_context: mode === 'approve_terms' ? draft.ai_context.trim() : undefined,
      });
      const resReq = await api.get('/travel/customer-requests', { params: { status: 'pending' } });
      if (resReq.data.success) setPendingRequests(resReq.data.data || []);
      setRequestActionMode(prev => { const n = { ...prev }; delete n[reqId]; return n; });
      setRequestActionDrafts(prev => { const n = { ...prev }; delete n[reqId]; return n; });
    } catch (err) {
      console.error('[CentralInfo] Failed to approve request:', err);
    } finally {
      setSubmittingIds(prev => { const s = new Set(prev); s.delete(`req_approve_${reqId}`); return s; });
    }
  };

  const handleRejectRequest = async (reqId) => {
    const reason = (requestActionDrafts[reqId] || {}).reason || '';
    if (!reason.trim()) return;
    setSubmittingIds(prev => new Set(prev).add(`req_reject_${reqId}`));
    try {
      await api.post(`/travel/customer-requests/${reqId}/reject`, { reason: reason.trim() });
      const resReq = await api.get('/travel/customer-requests', { params: { status: 'pending' } });
      if (resReq.data.success) setPendingRequests(resReq.data.data || []);
      setRequestActionMode(prev => { const n = { ...prev }; delete n[reqId]; return n; });
      setRequestActionDrafts(prev => { const n = { ...prev }; delete n[reqId]; return n; });
    } catch (err) {
      console.error('[CentralInfo] Failed to reject request:', err);
    } finally {
      setSubmittingIds(prev => { const s = new Set(prev); s.delete(`req_reject_${reqId}`); return s; });
    }
  };

  const handleTakeoverRequest = async (reqId, phone) => {
    setSubmittingIds(prev => new Set(prev).add(`req_takeover_${reqId}`));
    try {
      await api.post(`/travel/customer-requests/${reqId}/takeover`);
      navigate(`/leads?phone=${encodeURIComponent(phone)}`);
    } catch (err) {
      console.error('[CentralInfo] Failed to takeover request:', err);
    } finally {
      setSubmittingIds(prev => { const s = new Set(prev); s.delete(`req_takeover_${reqId}`); return s; });
    }
  };

  const tabCounts = {
    info_requests: infoRequests.filter(r => r.status === 'pending' || r.status === 'instructed').length,
    customer_mgmt: customerMgmt.length,
    pending_dates: customerMgmt.filter(c => c.date_status === 'pending_approval').length,
    pending_offers: pendingOffers.length,
    pending_requests: pendingRequests.length,
    cancellations: cancellations.length,
    refunds: refunds.filter(r => r.status === 'pending').length,
  };

  const customerHasPendingBlockers = (phone) => {
    const hasOffer = pendingOffers.some(o => o.phone === phone);
    const hasRequest = pendingRequests.some(r => r.phone === phone);
    return { hasOffer, hasRequest, blocked: hasOffer || hasRequest };
  };

  const getCustomerPendingItems = (phone) => {
    const items = [];
    const dateItem = customerMgmt.find(c => c.phone === phone && (c.date_status === 'pending_approval' || (c.requested_date && c.date_status !== 'approved' && c.date_status !== 'rejected')));
    if (dateItem) {
      items.push({
        type: 'date_approval',
        label: 'Approval Tanggal',
        detail: dateItem.requested_date ? fmtDateOnly(dateItem.requested_date) : 'Belum disebutkan',
        status: 'pending',
        note: dateItem.admin_note || null,
        id: dateItem.id,
      });
    }
    pendingOffers.filter(o => o.phone === phone).forEach(o => {
      items.push({
        type: 'offer',
        label: 'Penawaran Harga',
        detail: `${o.package_name || '-'} — ${fmtCurrency(Number(o.offered_price))}`,
        status: o.status === 'counter_offered' ? 'counter' : 'pending',
        note: o.admin_note || null,
        id: o.id,
      });
    });
    pendingRequests.filter(r => r.phone === phone).forEach(r => {
      items.push({
        type: 'request',
        label: 'Request Pelanggan',
        detail: r.request_detail || r.package_name || '-',
        status: r.status,
        note: r.admin_note || r.ai_context || null,
        id: r.id,
      });
    });
    return items;
  };

  const getPendingCounts = (phone) => {
    const dates = customerMgmt.filter(c => c.phone === phone && (c.date_status === 'pending_approval' || (c.requested_date && c.date_status !== 'approved' && c.date_status !== 'rejected'))).length;
    const offers = pendingOffers.filter(o => o.phone === phone && o.status === 'pending').length;
    const requests = pendingRequests.filter(r => r.phone === phone && r.status === 'pending').length;
    return { dates, offers, requests, total: dates + offers + requests };
  };

  const getSmartStatusLabel = (cust) => {
    if (cust.status === 'done') return { status: 'done', label: 'Selesai' };
    if (cust.status === 'canceled_customer') return { status: 'canceled_customer', label: 'Batal' };
    if (cust.status === 'waiting_payment') return { status: 'waiting_payment', label: 'Bayar' };
    if (cust.date_status === 'pending_approval') return { status: 'pending_approval', label: 'Approval Tanggal' };
    if (cust.date_status === 'approved') return { status: 'approved', label: 'Proses Order' };
    if (cust.date_status === 'rejected') return { status: 'rejected', label: 'Tanggal Ditolak' };
    if (cust.status === 'waiting_offer') return { status: 'waiting_offer', label: 'Proses Order' };
    if (cust.status === 'waiting_date') return { status: 'waiting_date', label: 'Konfirmasi Tanggal' };
    return { status: cust.status || 'pending', label: 'Baru' };
  };

  const selectedCustomer = detailCustomerId ? customerMgmt.find(c => c.id === detailCustomerId) : null;

  // Derive unique phones that appear in system guider (info requests)
  const guiderPhones = [...new Set(infoRequests.map(r => r.phone))];

  // Get the info request entries grouped by customer for guider column
  const getGuiderRequestsForPhone = (phone) =>
    infoRequests.filter(r => r.phone === phone);

  // Build merged list of customers (from customerMgmt + standalone from infoRequests)
  const allCustomerPhones = [
    ...new Set([
      ...customerMgmt.map(c => c.phone),
      ...pendingOffers.map(o => o.phone),
      ...pendingRequests.map(r => r.phone),
    ])
  ];

  const getCustomerDisplayName = (phone) => {
    const cm = customerMgmt.find(c => c.phone === phone);
    if (cm && cm.customer_name && !['pelanggan', 'kosong', ''].includes((cm.customer_name || '').toLowerCase().trim()))
      return cm.customer_name;
    const offer = pendingOffers.find(o => o.phone === phone);
    if (offer && offer.customer_name && !['pelanggan', 'kosong', ''].includes((offer.customer_name || '').toLowerCase().trim()))
      return offer.customer_name;
    const req = pendingRequests.find(r => r.phone === phone);
    if (req && req.customer_name && !['pelanggan', 'kosong', ''].includes((req.customer_name || '').toLowerCase().trim()))
      return req.customer_name;
    // Belum ada nama dikonfirmasi — tampilkan nomor
    return phone || '-';
  };

  // Stats for the inline strip
  const statsStrip = [
    { label: 'Pelanggan', value: customerMgmt.length },
    { label: 'Bid', value: tabCounts.pending_offers },
    { label: 'Request', value: tabCounts.pending_requests },
    { label: 'Quote', value: tabCounts.info_requests },
    { label: 'Data Request', value: tabCounts.pending_dates },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto w-full">
      {/* Clean flat header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#4F46E5' }}>Central Information</h1>
            <p className="text-sm text-gray-400 mt-0.5">Pusat informasi dan manajemen permintaan pelanggan</p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
          >
            <Icon name="RefreshCw" size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Inline Stats Strip */}
        <div className="mt-4 inline-flex items-center gap-6 bg-white border border-gray-200 rounded-xl px-5 py-3">
          {statsStrip.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <span className="text-[10px] text-gray-400 mb-0.5 whitespace-nowrap">{s.label}</span>
              <span className="text-2xl font-bold text-gray-800 leading-none">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Customer Management column */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style={{ height: '420px' }}>
          <div className="px-5 py-4 border-b border-gray-100 shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">Customer Management</h2>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 transparent' }}>
            {loading ? (
              <SkeletonList count={3} />
            ) : allCustomerPhones.length === 0 ? (
              <EmptyState icon="Users" title="Belum Ada Pelanggan" subtitle="AI belum mendeteksi pelanggan dengan intensi kuat." />
            ) : (
              <div className="divide-y divide-gray-100">
                {allCustomerPhones.map((phone) => {
                  const cust = customerMgmt.find(c => c.phone === phone);
                  const name = getCustomerDisplayName(phone);
                  const counts = getPendingCounts(phone);
                  const smartStatus = cust ? getSmartStatusLabel(cust) : { status: 'pending', label: 'Baru' };
                  return (
                    <CentralInfoCustomerRow
                      key={phone}
                      phone={phone}
                      name={name}
                      counts={counts}
                      smartStatus={smartStatus}
                      pendingOffers={pendingOffers.filter(o => o.phone === phone)}
                      pendingRequests={pendingRequests.filter(r => r.phone === phone)}
                      isSelected={detailCustomerId === (cust?.id)}
                      onOpen={() => {
                        if (cust) openCmChat(cust.id);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* System Guider column */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style={{ height: '420px' }}>
          <div className="px-5 py-4 border-b border-gray-100 shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">System Guider</h2>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 transparent' }}>
            {loading ? (
              <SkeletonList count={3} />
            ) : infoRequests.length === 0 ? (
              <EmptyState icon="MessageCircle" title="Tidak Ada Request" subtitle="AI belum membutuhkan arahan admin saat ini." />
            ) : (
              <div className="divide-y divide-gray-100">
                {guiderPhones.map((phone) => {
                  const requests = getGuiderRequestsForPhone(phone);
                  // Tampilkan phone jika nama belum dikonfirmasi
                  const name = (() => {
                    const fromReq = requests[0]?.customer_name;
                    const generic = ['pelanggan', 'kosong', '', null, undefined];
                    const fromCm = getCustomerDisplayName(phone);
                    if (fromCm && !generic.includes(fromCm.toLowerCase?.()) && fromCm !== phone) return fromCm;
                    if (fromReq && !generic.includes((fromReq || '').toLowerCase())) return fromReq;
                    return phone; // tampilkan nomor jika belum ada nama
                  })();
                  const initial = name.startsWith('+') ? '#' : (name || '#')[0].toUpperCase();
                  const latestReq = requests[0];
                  return (
                    <div key={phone} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
                        {latestReq && (
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(latestReq.status)}
                          </div>
                        )}
                      </div>
                      {latestReq && (
                        <button
                          onClick={() => openGuiderChat(latestReq.id)}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Detail Drawer */}
      {selectedCustomer && (
        <CustomerDetailDrawer
          customer={selectedCustomer}
          onClose={() => setDetailCustomerId(null)}
          pendingItems={getCustomerPendingItems(selectedCustomer.phone)}
          blockers={customerHasPendingBlockers(selectedCustomer.phone)}
          actionMode={dateActionMode}
          setDateActionMode={setDateActionMode}
          dateActionDrafts={dateActionDrafts}
          setDateActionDrafts={setDateActionDrafts}
          handleApproveDate={handleApproveDate}
          handleRejectDate={handleRejectDate}
          offers={pendingOffers.filter(o => o.phone === selectedCustomer.phone)}
          offerActionDrafts={offerActionDrafts}
          setOfferActionDrafts={setOfferActionDrafts}
          handleApproveOffer={handleApproveOffer}
          handleRejectOffer={handleRejectOffer}
          requests={pendingRequests.filter(r => r.phone === selectedCustomer.phone)}
          requestActionMode={requestActionMode}
          setRequestActionMode={setRequestActionMode}
          requestActionDrafts={requestActionDrafts}
          setRequestActionDrafts={setRequestActionDrafts}
          handleApproveRequest={handleApproveRequest}
          handleRejectRequest={handleRejectRequest}
          handleTakeoverRequest={handleTakeoverRequest}
          infoRequests={infoRequests.filter(r => r.phone === selectedCustomer.phone)}
          instructionDrafts={instructionDrafts}
          setInstructionDrafts={setInstructionDrafts}
          handleSendInstruction={handleSendInstruction}
          handleTakeoverInfoRequest={handleTakeover}
          submittingIds={submittingIds}
          cancellations={cancellations.filter(c => c.user_phone === selectedCustomer.phone)}
          modifications={modifications}
          statusInfo={statusInfo.filter(s => s.phone === selectedCustomer.phone)}
          refunds={refunds.filter(r => r.phone === selectedCustomer.phone)}
        />
      )}

      {/* Guider Chat Modal */}
      {guiderChatOpen && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px]"
            style={{ animation: 'guiderFadeIn 0.18s ease-out' }}
            onClick={() => setGuiderChatOpen(null)}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-3 sm:p-6">
            <div
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/80"
              style={{ maxHeight: 'calc(100vh - 48px)', height: '86vh', animation: 'guiderSlideUp 0.22s cubic-bezier(0.34,1.2,0.64,1)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <style>{`
                @keyframes guiderFadeIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes guiderSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
                @keyframes msgIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
                .guider-msg { animation: msgIn 0.18s ease-out; }
              `}</style>

              {/* Header — clean white */}
              <div className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center gap-3 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                  <Icon name={guiderRequest?.status === 'resolved' ? 'CheckCircle' : 'MessageSquare'} size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-gray-800 truncate leading-tight">
                      {guiderRequest?.customer_name || guiderRequest?.phone || 'Customer'}
                    </h3>
                    {guiderRequest?.status === 'resolved' && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold uppercase tracking-wide">
                        Selesai
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {guiderRequest?.phone}{guiderRequest?.questions ? ` · ${guiderRequest.questions.substring(0, 60)}${guiderRequest.questions.length > 60 ? '…' : ''}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setGuiderChatOpen(null)}
                  className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all shrink-0"
                >
                  <Icon name="X" size={14} />
                </button>
              </div>

              {/* Chat area — white bg */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 bg-gray-50" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
                {guiderRequest && (
                  <div className="bg-gradient-to-r from-indigo-50/90 to-violet-50/70 rounded-xl px-4 py-3 border border-indigo-100/60 guider-msg">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-600 text-[10px] font-semibold uppercase tracking-widest">
                        🤖 Laporan AI
                      </span>
                    </div>
                    <div className="text-[12.5px] text-gray-800 leading-relaxed font-medium">
                      {renderMarkdown(guiderRequest.questions)}
                    </div>
                    {guiderRequest.ai_notes && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="text-[11.5px] text-gray-500 leading-relaxed">
                          {renderMarkdown(guiderRequest.ai_notes)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* "Info yang Dibutuhkan" — hanya tampil jika bukan hanya satu field generic kosong */}
                {guiderRequest?.required_info?.length > 0 &&
                  // Sembunyikan jika hanya 1 field generic 'answer' yang belum dijawab (sudah ada di Pertanyaan Awal)
                  !(guiderRequest.required_info.length === 1 &&
                    guiderRequest.required_info[0].key === 'answer' &&
                    !guiderRequest.required_info[0].answered) && (
                  <div className="rounded-xl border border-gray-200 overflow-hidden guider-msg bg-white">
                    <div className="bg-gray-50 px-3.5 py-2 flex items-center gap-2 border-b border-gray-100">
                      <Icon name="ClipboardList" size={12} className="text-gray-400" />
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Info yang Dibutuhkan</span>
                      <span className="ml-auto text-[10px] text-gray-400">
                        {guiderRequest.required_info.filter(f => f.answered).length}/{guiderRequest.required_info.length} terjawab
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {guiderRequest.required_info.map((field, fi) => (
                        <div key={fi} className="flex items-start gap-2.5 px-3.5 py-2.5">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            field.answered ? 'bg-gray-800' : 'border border-gray-300'
                          }`}>
                            {field.answered && <Icon name="Check" size={9} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[11px] font-medium ${field.answered ? 'text-gray-400 line-through' : 'text-gray-600'}`}>{field.label}</p>
                            {field.answered
                              ? <p className="text-[12px] text-gray-700 font-semibold mt-0.5">{field.value}</p>
                              : <p className="text-[11px] text-gray-400 italic mt-0.5">Belum diisi admin</p>
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                {guiderChats.map((chat) => (
                  <div key={chat.id} className={`flex guider-msg ${
                    chat.role === 'admin' ? 'justify-end'
                    : chat.role === 'system' ? 'justify-center'
                    : 'justify-start'
                  }`}>
                    {chat.role === 'system' ? (
                      <div className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 max-w-[90%]">
                        <p className="text-[11px] text-gray-500">{renderMarkdown(chat.message)}</p>
                      </div>
                    ) : (
                      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                        chat.role === 'admin'
                          ? 'bg-gray-800 text-white rounded-br-sm'
                          : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm shadow-sm'
                      }`}>
                        <p className="text-[12.5px] leading-relaxed">
                          {renderMarkdown(chat.message)}
                        </p>
                        <span className={`block text-[9.5px] mt-1 ${
                          chat.role === 'admin' ? 'text-gray-400' : 'text-gray-400'
                        }`}>
                          {chat.created_at ? new Date(chat.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {guiderSending && (
                  <div className="flex justify-start guider-msg">
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay: '0ms'}} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay: '120ms'}} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay: '240ms'}} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={guiderChatEndRef} />
              </div>

              {guiderTodos.filter(t => t.status === 'pending').length > 0 && (
                <div className="border-t border-gray-100 bg-white px-4 py-3 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-gray-600">Instruksi Siap Kirim</span>
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold">
                        {guiderTodos.filter(t => t.status === 'pending').length}
                      </span>
                    </div>
                    <button
                      onClick={executeAllGuiderTodos}
                      disabled={guiderExecuting.size > 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-[11px] font-semibold hover:bg-gray-900 transition-all disabled:opacity-50"
                    >
                      {guiderExecuting.size > 0 ? (
                        <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Mengirim...</>
                      ) : (
                        <><Icon name="Send" size={11} /> Kirim Instruksi</>
                      )}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {guiderTodos.filter(t => t.status === 'pending').map((todo) => (
                      <div key={todo.id} className="flex items-start gap-2.5 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
                        <div className="w-4 h-4 rounded border-2 border-gray-300 flex items-center justify-center mt-0.5 shrink-0">
                          {guiderExecuting.has(todo.id) ? (
                            <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-gray-500" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-sm bg-gray-400" />
                          )}
                        </div>
                        <p className="text-[12px] text-gray-700 leading-relaxed flex-1">
                          {renderMarkdown(todo.instruction)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NEED_INFO_CARD — Proactive follow-up card */}
              {(() => {
                const needInfoTodos = guiderTodos.filter(t => t.todo_type === 'need_info');
                const draftTodo = needInfoTodos.find(t => t.status === 'draft');
                const awaitingTodo = needInfoTodos.find(t => t.status === 'awaiting_customer');
                const receivedTodo = needInfoTodos.find(t => t.status === 'info_received');

                if (draftTodo) {
                  let questions = [];
                  let summary = '';
                  try {
                    const parsed = JSON.parse(draftTodo.instruction);
                    questions = parsed.questions || [];
                    summary = parsed.summary || '';
                  } catch {}

                  return (
                    <div className="border-t border-gray-100 bg-white px-4 py-3 shrink-0">
                      <div className="rounded-xl border border-sky-200 bg-sky-50/50 overflow-hidden">
                        <div className="bg-sky-100/60 px-3.5 py-2 flex items-center gap-2 border-b border-sky-200/60">
                          <Icon name="HelpCircle" size={12} className="text-sky-500" />
                          <span className="text-[10px] font-semibold text-sky-600 uppercase tracking-widest">Pertanyaan untuk Customer</span>
                          <span className="ml-auto px-1.5 py-0.5 rounded bg-sky-200/60 text-sky-700 text-[9px] font-bold">DRAFT</span>
                        </div>
                        <div className="px-3.5 py-2.5 space-y-1.5">
                          {questions.map((q, qi) => (
                            <div key={qi} className="flex items-start gap-2">
                              <span className="text-[10px] text-sky-400 font-bold mt-0.5 shrink-0">{qi + 1}.</span>
                              <p className="text-[12px] text-gray-700 leading-relaxed">{q.question}</p>
                            </div>
                          ))}
                        </div>
                        {summary && (
                          <div className="px-3.5 pb-2 pt-0">
                            <p className="text-[10.5px] text-gray-400 italic">{summary}</p>
                          </div>
                        )}
                        <div className="px-3.5 py-2.5 border-t border-sky-200/40 flex items-center gap-2">
                          <button
                            onClick={() => executeNeedInfoHandler(draftTodo.id)}
                            disabled={guiderExecuting.has(draftTodo.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white rounded-lg text-[11px] font-semibold hover:bg-sky-700 transition-all disabled:opacity-50"
                          >
                            {guiderExecuting.has(draftTodo.id) ? (
                              <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Mengirim...</>
                            ) : (
                              <><Icon name="Send" size={11} /> Proceed</>
                            )}
                          </button>
                          <span className="text-[10px] text-gray-400">atau kirim pesan untuk revisi</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (awaitingTodo) {
                  let questions = [];
                  try { questions = JSON.parse(awaitingTodo.instruction)?.questions || []; } catch {}
                  return (
                    <div className="border-t border-gray-100 bg-sky-50/30 px-4 py-3 shrink-0">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                        <span className="text-[11px] font-semibold text-sky-600">AI sedang menanyakan informasi ke customer</span>
                      </div>
                      <div className="space-y-1">
                        {questions.map((q, qi) => (
                          <div key={qi} className="flex items-center gap-2">
                            <Icon name={q.answered ? 'CheckCircle' : 'Circle'} size={10} className={q.answered ? 'text-emerald-400' : 'text-gray-300'} />
                            <span className="text-[11px] text-gray-500">{q.question}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (receivedTodo) {
                  return (
                    <div className="border-t border-gray-100 bg-teal-50/30 px-4 py-3 shrink-0 flex items-center gap-2.5">
                      <Icon name="CheckCircle" size={13} className="text-teal-500 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-teal-700">Info dari customer diterima</p>
                        <p className="text-[10px] text-teal-500">{receivedTodo.result || 'Semua pertanyaan terjawab'}</p>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

              {guiderTodos.filter(t => t.status === 'done').length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 shrink-0 flex items-center gap-2">
                  <Icon name="CheckCircle" size={11} className="text-gray-400" />
                  <span className="text-[10.5px] text-gray-500">
                    {guiderTodos.filter(t => t.status === 'done').length} instruksi berhasil dikirim
                  </span>
                </div>
              )}

              {guiderRequest?.status === 'resolved' || guiderRequest?.status === 'info_received' ? (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3.5 shrink-0 flex items-center gap-3">
                  <Icon name="CheckCircle" size={14} className="text-gray-400 shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-gray-700">
                      {guiderRequest.status === 'info_received' ? 'Info dari customer diterima' : 'Request selesai'}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {guiderRequest.status === 'info_received' ? 'Semua pertanyaan customer sudah dijawab.' : 'Instruksi sudah dikirim ke customer.'}
                    </p>
                  </div>
                </div>
              ) : guiderRequest?.status === 'awaiting_customer' ? (
                <div className="border-t border-gray-100 bg-sky-50/40 px-4 py-3.5 shrink-0 flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-sky-700">Menunggu jawaban customer</p>
                    <p className="text-[11px] text-sky-400">AI sedang menanyakan informasi yang dibutuhkan.</p>
                  </div>
                </div>
              ) : (
                <div className="border-t border-gray-100 bg-white px-4 py-3 shrink-0">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={guiderInput}
                      onChange={(e) => setGuiderInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGuiderMessage(); } }}
                      placeholder="Ketik instruksi atau pesan..."
                      rows={1}
                      className="flex-1 resize-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-[12.5px] bg-gray-50 focus:outline-none focus:border-gray-400 focus:bg-white transition-all placeholder:text-gray-400 text-gray-700"
                      style={{ minHeight: '42px', maxHeight: '120px' }}
                    />
                    <button
                      onClick={sendGuiderMessage}
                      disabled={!guiderInput.trim() || guiderSending}
                      className="w-9 h-9 rounded-xl bg-gray-800 text-white flex items-center justify-center hover:bg-gray-900 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    >
                      <Icon name="Send" size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* CM Copilot Chat Room Modal */}
      {cmChatOpen && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px]"
            style={{ animation: 'guiderFadeIn 0.18s ease-out' }}
            onClick={() => { setCmChatOpen(null); setCmProceedDraft(null); }}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-3 sm:p-6">
            <div
              className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex overflow-hidden border border-white/80"
              style={{ maxHeight: 'calc(100vh - 48px)', height: '88vh', animation: 'guiderSlideUp 0.22s cubic-bezier(0.34,1.2,0.64,1)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Main Chat Area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Header — clean white */}
                <div className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center gap-3 shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                    <Icon name="Users" size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-gray-800 truncate leading-tight">
                        {cmData?.customer_name || cmData?.phone || 'Customer'}
                      </h3>
                      {cmData?.status === 'completed' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold uppercase tracking-wide">
                          Selesai
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {cmData?.phone}{cmData?.package_name ? ` · ${cmData.package_name}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => { setCmChatOpen(null); setCmProceedDraft(null); }}
                    className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all shrink-0"
                  >
                    <Icon name="X" size={14} />
                  </button>
                </div>

                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 bg-gray-50" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
                  {/* Initial context */}
                  {cmItems.length > 0 && cmChats.length === 0 && (
                    <div className="bg-white rounded-xl px-4 py-3 border border-gray-200 guider-msg">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Request Items</span>
                      </div>
                      <div className="text-[12.5px] text-gray-700 leading-relaxed">
                        Customer ini memiliki {cmItems.length} request yang perlu ditangani. Ketik pesan untuk mulai berdiskusi dengan AI.
                      </div>
                    </div>
                  )}

                  {cmChats.map((chat) => {
                    // ── Status Update Card ──
                    if (chat.message_type === 'status_update') {
                      let data;
                      try { data = typeof chat.message === 'string' ? JSON.parse(chat.message) : chat.message; } catch { data = null; }
                      if (!data) return null;
                      const borderColor = data.status === 'approved' ? 'border-emerald-300' :
                                          data.status === 'rejected' ? 'border-red-300' : 'border-amber-300';
                      const bgColor = data.status === 'approved' ? 'bg-emerald-50' :
                                      data.status === 'rejected' ? 'bg-red-50' : 'bg-amber-50';
                      const iconBg = data.status === 'approved' ? 'bg-emerald-500' :
                                     data.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500';
                      return (
                        <div key={chat.id} className="flex justify-center guider-msg">
                          <div className={`w-full max-w-[85%] rounded-xl border ${borderColor} ${bgColor} px-4 py-3`}>
                            <div className="flex items-start gap-3">
                              <div className={`w-7 h-7 rounded-full ${iconBg} text-white flex items-center justify-center shrink-0 mt-0.5`}>
                                {data.status === 'approved' ? <Icon name="Check" size={13} /> :
                                 data.status === 'rejected' ? <Icon name="X" size={13} /> :
                                 <Icon name="FileText" size={13} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{data.type_label || 'Request'}</span>
                                </div>
                                <p className="text-[12px] font-semibold text-gray-800 mt-0.5">{data.title}</p>
                                <p className="text-[11px] text-gray-600 mt-1">
                                  Status: <span className="font-semibold">{data.status_label}</span>
                                </p>
                                {data.decision && (
                                  <p className="text-[10.5px] text-gray-500 mt-0.5 italic">Catatan: {data.decision}</p>
                                )}
                              </div>
                            </div>
                            <span className="block text-[9px] text-gray-400 mt-2 text-right">
                              {chat.created_at ? new Date(chat.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // ── Decision Summary Card ──
                    if (chat.message_type === 'decision_summary') {
                      let data;
                      try { data = typeof chat.message === 'string' ? JSON.parse(chat.message) : chat.message; } catch { data = null; }
                      if (!data) return null;
                      return (
                        <div key={chat.id} className="flex justify-center guider-msg">
                          <div className="w-full max-w-[90%] rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white overflow-hidden">
                            <div className="bg-indigo-100/60 px-4 py-2.5 flex items-center gap-2 border-b border-indigo-200">
                              <Icon name="ClipboardCheck" size={14} className="text-indigo-600" />
                              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest">Ringkasan Keputusan</span>
                              <span className="ml-auto text-[10px] text-indigo-500 font-semibold">
                                {data.approved_count} Approved · {data.rejected_count} Rejected
                              </span>
                            </div>
                            <div className="divide-y divide-indigo-100">
                              {(data.items || []).map((item, idx) => {
                                const isApproved = item.status === 'approved';
                                const isRejected = item.status === 'rejected';
                                return (
                                  <div key={idx} className="flex items-start gap-3 px-4 py-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                      isApproved ? 'bg-emerald-500' : isRejected ? 'bg-red-500' : 'bg-amber-500'
                                    }`}>
                                      {isApproved ? <Icon name="Check" size={12} className="text-white" /> :
                                       isRejected ? <Icon name="X" size={12} className="text-white" /> :
                                       <Icon name="FileText" size={12} className="text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-semibold text-gray-400 uppercase">{item.type_label}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                          isApproved ? 'bg-emerald-100 text-emerald-700' : isRejected ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                          {isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : 'NOTED'}
                                        </span>
                                      </div>
                                      <p className="text-[11.5px] font-semibold text-gray-700 mt-0.5">{item.title}</p>
                                      {item.decision && (
                                        <p className="text-[10px] text-gray-500 mt-0.5 italic">{item.decision}</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="px-4 py-2.5 bg-emerald-50 border-t border-indigo-100 flex items-center gap-2">
                              <Icon name="CheckCircle" size={13} className="text-emerald-600" />
                              <span className="text-[11px] font-semibold text-emerald-700">Semua request telah diputuskan</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // ── Question Pending / Answered System Cards ──
                    if (chat.message_type === 'question_pending' || chat.message_type === 'question_answered') {
                      let data;
                      try { data = typeof chat.message === 'string' ? JSON.parse(chat.message) : chat.message; } catch { data = null; }
                      if (!data) return null;
                      const isAnswered = chat.message_type === 'question_answered';
                      return (
                        <div key={chat.id} className="flex justify-center guider-msg">
                          <div className={`w-full max-w-[88%] rounded-xl border px-4 py-3 ${
                            isAnswered ? 'border-teal-200 bg-teal-50' : 'border-blue-200 bg-blue-50'
                          }`}>
                            <div className="flex items-start gap-3">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-white ${
                                isAnswered ? 'bg-teal-500' : 'bg-blue-500'
                              }`}>
                                <Icon name={isAnswered ? 'CheckCheck' : 'HelpCircle'} size={13} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[9px] font-semibold uppercase tracking-widest mb-1 ${
                                  isAnswered ? 'text-teal-400' : 'text-blue-400'
                                }`}>
                                  {isAnswered ? '✅ Customer Menjawab' : '❓ Menunggu Jawaban Customer'}
                                </p>
                                <p className="text-[11px] text-gray-600">Terkait: <span className="font-semibold">{data.title}</span></p>
                                <p className="text-[11.5px] text-gray-700 mt-1 italic">"{data.question}"</p>
                                {isAnswered && data.answer && (
                                  <div className="mt-2 pt-2 border-t border-teal-200">
                                    <p className="text-[9px] font-semibold text-teal-400 uppercase tracking-widest mb-0.5">Jawaban Customer:</p>
                                    <p className="text-[12px] font-semibold text-teal-700">{data.answer}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="block text-[9px] text-gray-400 mt-2 text-right">
                              {chat.created_at ? new Date(chat.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // ── Regular Messages (admin/ai/system) ──
                    return (
                    <div key={chat.id} className={`flex guider-msg ${
                      chat.role === 'admin' ? 'justify-end'
                      : chat.role === 'system' ? 'justify-center'
                      : 'justify-start'
                    }`}>
                      {chat.role === 'system' ? (
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 max-w-[90%]">
                          <p className="text-[11px] text-gray-500">{renderMarkdown(chat.message)}</p>
                        </div>
                      ) : (
                        <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                          chat.role === 'admin'
                            ? 'bg-gray-800 text-white rounded-br-sm'
                            : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm shadow-sm'
                        }`}>
                          <p className="text-[12.5px] leading-relaxed">
                            {renderMarkdown(chat.message)}
                          </p>
                          <span className="block text-[9.5px] mt-1 text-gray-400">
                            {chat.created_at ? new Date(chat.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    );
                  })}

                  {cmSending && (
                    <div className="flex justify-start guider-msg">
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
                        <div className="flex gap-1 items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay: '0ms'}} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay: '120ms'}} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay: '240ms'}} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={cmChatEndRef} />
                </div>

                {/* Proceed Draft Section */}
                {cmProceedDraft && (
                  <div className="border-t border-gray-100 bg-white px-4 py-3 shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="FileText" size={13} className="text-gray-500" />
                      <span className="text-[11px] font-semibold text-gray-600">Draft Pesan ke Customer</span>
                    </div>
                    <textarea
                      value={cmProceedDraft}
                      onChange={(e) => setCmProceedDraft(e.target.value)}
                      className="w-full resize-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-[12.5px] bg-gray-50 focus:outline-none focus:border-gray-400 focus:bg-white transition-all text-gray-700"
                      rows={4}
                      style={{ maxHeight: '150px' }}
                    />
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <button
                        onClick={() => setCmProceedDraft(null)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleCmSendToCustomer}
                        disabled={cmProceedSending}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white rounded-lg text-xs font-semibold hover:bg-gray-900 transition-all disabled:opacity-50"
                      >
                        {cmProceedSending ? (
                          <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Mengirim...</>
                        ) : (
                          <><Icon name="Send" size={12} /> Kirim ke Customer</>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Input bar / Session status */}
                {cmData?.status === 'completed' && !cmProceedDraft ? (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3.5 shrink-0 flex items-center gap-3">
                    <Icon name="Lock" size={14} className="text-gray-400 shrink-0" />
                    <div>
                      <p className="text-[12px] font-semibold text-gray-600">Session selesai</p>
                      <p className="text-[10.5px] text-gray-400">Semua request telah diputuskan. Anda hanya bisa melihat history.</p>
                    </div>
                  </div>
                ) : !cmProceedDraft && (
                  <div className="border-t border-gray-100 bg-white px-4 py-3 shrink-0">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={cmInput}
                        onChange={(e) => setCmInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCmMessage(); } }}
                        placeholder="Ketik pesan atau instruksi..."
                        rows={1}
                        className="flex-1 resize-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-[12.5px] bg-gray-50 focus:outline-none focus:border-gray-400 focus:bg-white transition-all placeholder:text-gray-400 text-gray-700"
                        style={{ minHeight: '42px', maxHeight: '120px' }}
                      />
                      <button
                        onClick={sendCmMessage}
                        disabled={!cmInput.trim() || cmSending}
                        className="w-9 h-9 rounded-xl bg-gray-800 text-white flex items-center justify-center hover:bg-gray-900 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                      >
                        <Icon name="Send" size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar: Request Items */}
              <div className="w-64 border-l border-gray-100 bg-white flex flex-col shrink-0">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Request Items</span>
                    <span className="ml-auto px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold">
                      {cmItems.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
                  {cmItems.length === 0 ? (
                    <div className="text-center py-8">
                      <Icon name="Inbox" size={22} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-[11px] text-gray-400">Belum ada request</p>
                    </div>
                  ) : (
                    cmItems.map((item) => {
                      const typeLabel = {
                        booking_request: 'Booking', bargain_offer: 'Penawaran',
                        date_request: 'Tanggal', custom_request: 'Custom'
                      }[item.item_type] || item.item_type;
                      const statusStyle = {
                        approved: 'bg-emerald-500 text-white',
                        rejected: 'bg-red-100 text-red-600',
                        notes_added: 'bg-amber-100 text-amber-700',
                        pending: 'bg-gray-100 text-gray-500',
                        pending_question: 'bg-blue-100 text-blue-700',
                        question_asked: 'bg-sky-100 text-sky-700',
                        question_answered: 'bg-teal-100 text-teal-700',
                      }[item.status] || 'bg-gray-100 text-gray-500';
                      const statusLabel = {
                        approved: 'Approved', rejected: 'Rejected',
                        notes_added: 'Noted', pending: 'Pending',
                        pending_question: '❓ Menunggu Jawaban',
                        question_asked: '💬 Sudah Ditanya',
                        question_answered: '✅ Terjawab',
                      }[item.status] || item.status;

                      const isActionable = ['pending', 'notes_added', 'question_answered'].includes(item.status);
                      const actionMode = cmItemActionMode[item.id];
                      const actionDraft = cmItemActionDrafts[item.id] || {};
                      const isUpdating = cmItemUpdating.has(item.id);

                      return (
                        <div key={item.id} className={`rounded-xl border p-3 transition-all ${
                          item.status === 'approved' ? 'bg-emerald-50 border-emerald-200' :
                          item.status === 'rejected' ? 'bg-red-50 border-red-200' :
                          'bg-white border-gray-200'
                        }`}>
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">{typeLabel}</span>
                              </div>
                              <p className="text-[11.5px] font-semibold text-gray-700 leading-snug">{item.title}</p>
                              {item.detail && (
                                <p className="text-[10.5px] text-gray-500 mt-0.5 line-clamp-2">{item.detail}</p>
                              )}
                              <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[9px] font-semibold ${statusStyle}`}>
                                {statusLabel}
                              </span>
                              {item.admin_decision && (
                                <p className="text-[10px] text-gray-500 mt-1 italic">{item.admin_decision}</p>
                              )}
                              {item.pending_question && (
                                <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
                                  <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-widest mb-0.5">Menunggu Jawaban Customer</p>
                                  <p className="text-[11px] text-blue-700 italic">"{item.pending_question}"</p>
                                  {item.question_answer && (
                                    <div className="mt-1.5 pt-1.5 border-t border-blue-200">
                                      <p className="text-[9px] font-semibold text-teal-500 uppercase tracking-widest mb-0.5">Jawaban:</p>
                                      <p className="text-[11px] text-teal-700 font-semibold">{item.question_answer}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons — show for pending/notes_added/question_answered items */}
                          {isActionable && !isUpdating && !actionMode && (
                            <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-gray-100">
                              <button
                                onClick={() => handleCmItemAction(item.id, 'approved', null)}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                                title="Approve"
                              >
                                <Icon name="Check" size={11} /> Approve
                              </button>
                              <button
                                onClick={() => setCmItemActionMode(prev => ({ ...prev, [item.id]: 'reject' }))}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                title="Reject"
                              >
                                <Icon name="X" size={11} /> Reject
                              </button>
                              <button
                                onClick={() => setCmItemActionMode(prev => ({ ...prev, [item.id]: 'notes' }))}
                                className="flex items-center justify-center py-1.5 px-2 rounded-lg text-[10px] font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                title="Add Notes"
                              >
                                <Icon name="FileText" size={11} />
                              </button>
                              <button
                                onClick={() => setCmItemActionMode(prev => ({ ...prev, [item.id]: 'question' }))}
                                className="flex items-center justify-center py-1.5 px-2 rounded-lg text-[10px] font-semibold bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                                title="Tanya Customer"
                              >
                                <Icon name="HelpCircle" size={11} />
                              </button>
                            </div>
                          )}

                          {/* Reject/Notes/Question input */}
                          {isActionable && actionMode && (
                            <div className="mt-2.5 pt-2 border-t border-gray-100">
                              <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">
                                {actionMode === 'reject' ? 'Alasan Reject' : actionMode === 'question' ? '❓ Tanya ke Customer' : 'Catatan'}
                              </label>
                              <textarea
                                value={actionMode === 'question' ? (cmItemQuestionDrafts[item.id] || '') : (actionDraft.text || '')}
                                onChange={(e) => {
                                  if (actionMode === 'question') {
                                    setCmItemQuestionDrafts(prev => ({ ...prev, [item.id]: e.target.value }));
                                  } else {
                                    setCmItemActionDrafts(prev => ({ ...prev, [item.id]: { text: e.target.value } }));
                                  }
                                }}
                                placeholder={
                                  actionMode === 'reject' ? 'Tulis alasan reject...'
                                  : actionMode === 'question' ? 'Contoh: Tanya berapa orang yang akan ikut trip ini...'
                                  : 'Tulis catatan...'
                                }
                                rows={2}
                                className="w-full resize-none border border-gray-200 rounded-lg px-2.5 py-2 text-[11px] bg-gray-50 focus:outline-none focus:border-gray-400 focus:bg-white transition-all placeholder:text-gray-400 text-gray-700"
                              />
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <button
                                  onClick={() => {
                                    if (actionMode === 'question') {
                                      handleSetItemQuestion(item.id);
                                    } else {
                                      const text = (actionDraft.text || '').trim();
                                      if (actionMode === 'reject' && !text) return;
                                      handleCmItemAction(
                                        item.id,
                                        actionMode === 'reject' ? 'rejected' : 'notes_added',
                                        text || null
                                      );
                                    }
                                  }}
                                  disabled={
                                    actionMode === 'reject' ? !(actionDraft.text || '').trim()
                                    : actionMode === 'question' ? !(cmItemQuestionDrafts[item.id] || '').trim()
                                    : false
                                  }
                                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors disabled:opacity-40 ${
                                    actionMode === 'reject'
                                      ? 'bg-red-500 text-white hover:bg-red-600'
                                      : actionMode === 'question'
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-amber-500 text-white hover:bg-amber-600'
                                  }`}
                                >
                                  {actionMode === 'reject' ? <><Icon name="X" size={10} /> Reject</>
                                   : actionMode === 'question' ? <><Icon name="HelpCircle" size={10} /> Tanya Customer</>
                                   : <><Icon name="FileText" size={10} /> Simpan</>}
                                </button>
                                <button
                                  onClick={() => {
                                    setCmItemActionMode(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                                    setCmItemActionDrafts(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                                    setCmItemQuestionDrafts(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                                  }}
                                  className="px-2 py-1.5 rounded-lg text-[10px] font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Updating spinner */}
                          {isUpdating && (
                            <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-gray-100">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500" />
                              <span className="text-[10px] text-gray-500">Memproses...</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Proceed Button — smart logic */}
                {cmItems.length > 0 && cmData?.status !== 'completed' && (() => {
                  const resolvedStatuses = ['approved', 'rejected'];
                  const pendingCount = cmItems.filter(i => !resolvedStatuses.includes(i.status)).length;
                  const allResolved = pendingCount === 0;
                  return (
                    <div className="border-t border-gray-100 bg-white px-3 py-3 shrink-0">
                      <button
                        onClick={handleCmProceed}
                        disabled={cmProceedSending || !!cmProceedDraft || !allResolved}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 text-white rounded-xl text-xs font-semibold hover:bg-gray-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!allResolved ? `Masih ada ${pendingCount} request yang belum diputuskan` : ''}
                      >
                        {cmProceedSending ? (
                          <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Membuat draft...</>
                        ) : !allResolved ? (
                          <><Icon name="Clock" size={12} /> {pendingCount} request belum diputuskan</>
                        ) : (
                          <><Icon name="Send" size={12} /> Proceed to Customer</>
                        )}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── CentralInfoCustomerRow ──────────────────────────────────────────
// Simple flat row used in the new two-column layout
const CentralInfoCustomerRow = ({
  name,
  counts,
  isSelected,
  onOpen,
}) => {
  // Jika name adalah nomor (belum ada nama dikonfirmasi), tampilkan '#' sebagai initial
  const initials = (!name || name.startsWith('+') || /^\d/.test(name)) ? '#' : name[0].toUpperCase();


  // Build pill badges to show (Bid, Request, etc.)
  const pills = [];
  if (counts.offers > 0) pills.push({ label: 'Bid', color: 'bg-indigo-100 text-indigo-700' });
  if (counts.requests > 0) pills.push({ label: 'Request', color: 'bg-rose-100 text-rose-600' });
  if (counts.dates > 0) pills.push({ label: 'Tanggal', color: 'bg-amber-100 text-amber-700' });

  return (
    <div
      className={`flex items-center gap-3 px-5 py-4 transition-colors ${
        isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
      }`}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center font-semibold text-sm shrink-0">
        {initials}
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
        {pills.length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {pills.map((pill) => (
              <span
                key={pill.label}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${pill.color}`}
              >
                {pill.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Open button */}
      <button
        onClick={onOpen}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
      >
        Open
      </button>
    </div>
  );
};

export default CentralInfo;

import { useState } from 'react';
import { adminAPI, auditAPI, ledgerAPI, reconcileAPI, transactionHistoryAPI, allAuditAPI } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LedgerEntry {
  id: string;
  transactionId: string;
  walletId: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

interface ReconcileEntry {
  walletId: string;
  ledgerBalance: number;
  actualBalance: number;
  balanced: boolean;
}

interface TxnRecord {
  id: string;
  amount: number;
  type: string;
  status: string;
  sourceWalletId: string;
  targetWalletId: string;
  createdAt: string;
}

interface AuditRecord {
  id: string;
  userId: string;
  userEmail: string;
  transactionId: string | null;
  action: string;
  entityType: string;
  details: string | null;
  createdAt: string;
}

// ─── Tab Definition ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'deposit',   label: '💰 Deposit',      short: 'Deposit' },
  { id: 'history',   label: '📜 Transactions', short: 'Transactions' },
  { id: 'ledger',    label: '📒 Ledger',       short: 'Ledger' },
  { id: 'reconcile', label: '🔄 Reconcile',    short: 'Reconcile' },
  { id: 'verify',    label: '✅ Verify',       short: 'Verify' },
  { id: 'audit',     label: '📋 Audit Logs',   short: 'Audit' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
const shortId = (id: string) => id ? id.slice(-12).toUpperCase() : '—';
const fmtTime = (s: string) => s ? new Date(s).toLocaleString() : '—';

const statusColor: Record<string, string> = {
  SUCCESS:  'rgba(34,197,94,0.15)',
  FAILED:   'rgba(239,68,68,0.15)',
  REFUNDED: 'rgba(245,158,11,0.15)',
  PENDING:  'rgba(59,130,246,0.15)',
  INITIATED:'rgba(100,116,139,0.15)',
};
const statusText: Record<string, string> = {
  SUCCESS:  '#22c55e',
  FAILED:   '#ef4444',
  REFUNDED: '#f59e0b',
  PENDING:  '#3b82f6',
  INITIATED:'#64748b',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('deposit');

  // ── Deposit ──────────────────────────────────────────────────────────────
  const [depositWalletId, setDepositWalletId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositMessage, setDepositMessage] = useState('');
  const [depositError, setDepositError] = useState('');
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookedUpUser, setLookedUpUser] = useState<{ userId: string; email: string; fullName: string } | null>(null);
  const [lookedUpWallets, setLookedUpWallets] = useState<any[]>([]);

  // ── Transactions History ──────────────────────────────────────────────────
  const [txns, setTxns] = useState<TxnRecord[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(false);
  const [txnsError, setTxnsError] = useState('');
  const [txnFilter, setTxnFilter] = useState('');

  // ── Ledger Explorer ───────────────────────────────────────────────────────
  const [ledgerWalletId, setLedgerWalletId] = useState('');
  const [ledgerTxnId, setLedgerTxnId] = useState('');
  const [ledgerResults, setLedgerResults] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');

  // ── Reconcile ─────────────────────────────────────────────────────────────
  const [reconcileResults, setReconcileResults] = useState<ReconcileEntry[]>([]);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileError, setReconcileError] = useState('');

  // ── Verify ────────────────────────────────────────────────────────────────
  const [verifyTxnId, setVerifyTxnId] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ balanced: boolean; transactionId: string } | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // ── Audit Logs ────────────────────────────────────────────────────────────
  const [auditMode, setAuditMode] = useState<'search' | 'all'>('search');
  const [auditUserId, setAuditUserId] = useState('');
  const [auditTxnId, setAuditTxnId] = useState('');
  const [auditResults, setAuditResults] = useState<AuditRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleLookup = async (queryParam?: string) => {
    const query = queryParam || lookupQuery;
    if (!query) { setDepositError('Enter an email or wallet UUID.'); return; }
    setLookupLoading(true); setDepositError(''); setDepositMessage('');
    setLookedUpUser(null); setLookedUpWallets([]); setDepositWalletId('');
    try {
      const res = await adminAPI.lookupUserWallets(query);
      setLookedUpUser({ userId: res.data.userId, email: res.data.email, fullName: res.data.fullName });
      setLookedUpWallets(res.data.wallets);
      if (res.data.wallets?.length > 0) setDepositWalletId(res.data.wallets[0].id);
    } catch (err: any) {
      setDepositError(err.response?.data?.message || 'User or wallet not found.');
    } finally { setLookupLoading(false); }
  };

  const handleDeposit = async () => {
    setDepositMessage(''); setDepositError('');
    if (!depositWalletId || !depositAmount) { setDepositError('Wallet and amount are required.'); return; }
    setDepositLoading(true);
    try {
      const res = await adminAPI.deposit(depositWalletId, parseFloat(depositAmount));
      setDepositMessage(res.data.message || 'Deposit successful.');
      setDepositAmount('');
      if (lookupQuery) handleLookup(lookupQuery);
    } catch (err: any) {
      setDepositError(err.response?.data?.message || 'Deposit failed.');
    } finally { setDepositLoading(false); }
  };

  const handleLoadTransactions = async () => {
    setTxnsError(''); setTxnsLoading(true); setTxns([]);
    try {
      const res = await transactionHistoryAPI.getAll();
      setTxns(res.data);
    } catch (err: any) {
      setTxnsError(err.response?.data?.message || 'Failed to load transactions.');
    } finally { setTxnsLoading(false); }
  };

  const handleLedgerByWallet = async () => {
    if (!ledgerWalletId) return;
    setLedgerError(''); setLedgerLoading(true); setLedgerResults([]);
    try { const res = await ledgerAPI.getByWallet(ledgerWalletId); setLedgerResults(res.data); }
    catch (err: any) { setLedgerError(err.response?.data?.message || 'Failed to fetch ledger entries.'); }
    finally { setLedgerLoading(false); }
  };

  const handleLedgerByTxn = async () => {
    if (!ledgerTxnId) return;
    setLedgerError(''); setLedgerLoading(true); setLedgerResults([]);
    try { const res = await ledgerAPI.getByTransaction(ledgerTxnId); setLedgerResults(res.data); }
    catch (err: any) { setLedgerError(err.response?.data?.message || 'Failed to fetch ledger entries.'); }
    finally { setLedgerLoading(false); }
  };

  const handleReconcile = async () => {
    setReconcileError(''); setReconcileLoading(true); setReconcileResults([]);
    try { const res = await reconcileAPI.runAll(); setReconcileResults(res.data); }
    catch (err: any) { setReconcileError(err.response?.data?.message || 'Reconciliation failed.'); }
    finally { setReconcileLoading(false); }
  };

  const handleVerify = async () => {
    if (!verifyTxnId) return;
    setVerifyError(''); setVerifyLoading(true); setVerifyResult(null);
    try { const res = await reconcileAPI.verifyTransaction(verifyTxnId); setVerifyResult(res.data); }
    catch (err: any) { setVerifyError(err.response?.data?.message || 'Verification failed.'); }
    finally { setVerifyLoading(false); }
  };

  const handleAuditByUser = async () => {
    if (!auditUserId) return;
    setAuditError(''); setAuditLoading(true); setAuditResults([]);
    try { const res = await auditAPI.getByUser(auditUserId); setAuditResults(res.data); }
    catch (err: any) { setAuditError(err.response?.data?.message || 'Failed to fetch audit logs.'); }
    finally { setAuditLoading(false); }
  };

  const handleAuditByTxn = async () => {
    if (!auditTxnId) return;
    setAuditError(''); setAuditLoading(true); setAuditResults([]);
    try { const res = await auditAPI.getByTransaction(auditTxnId); setAuditResults(res.data); }
    catch (err: any) { setAuditError(err.response?.data?.message || 'Failed to fetch audit logs.'); }
    finally { setAuditLoading(false); }
  };

  const handleAuditAll = async () => {
    setAuditError(''); setAuditLoading(true); setAuditResults([]);
    try { const res = await allAuditAPI.getAll(); setAuditResults(res.data); }
    catch (err: any) { setAuditError(err.response?.data?.message || 'Failed to fetch audit logs.'); }
    finally { setAuditLoading(false); }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="page-header">
        <h1 className="page-header__title">Admin Control Panel</h1>
        <p className="page-header__subtitle">Full system visibility — transactions, ledger, reconciliation, and audit</p>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-color)', paddingBottom: '0',
        overflowX: 'auto',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.6rem 1.1rem', border: 'none', background: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600,
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════ DEPOSIT ═══════════════════════════════ */}
      {activeTab === 'deposit' && (
        <div className="card">
          <h3 style={{ marginBottom: '0.25rem', fontWeight: 700, fontSize: '1rem' }}>💰 Manual Deposit</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted, var(--text-muted))', marginBottom: '1rem' }}>
            Search for a user by email or wallet UUID, then deposit funds into their wallet.
          </p>

          {depositError && <div className="alert alert--error">⚠ {depositError}</div>}
          {depositMessage && <div className="alert alert--success">✓ {depositMessage}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="lookup-query">Lookup User (Email or Wallet UUID)</label>
              <input id="lookup-query" className="form-input" type="text"
                placeholder="user@example.com  or  wallet-uuid"
                value={lookupQuery} onChange={(e) => setLookupQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(); }} />
            </div>
            <button id="lookup-btn" className="btn btn--ghost" onClick={() => handleLookup()} disabled={lookupLoading}>
              {lookupLoading ? <span className="spinner" /> : 'Lookup'}
            </button>
          </div>

          {lookedUpUser && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              {/* User info banner */}
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(59,130,246,0.06)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.15)' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                  👤 {lookedUpUser.fullName} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({lookedUpUser.email})</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  User ID: {lookedUpUser.userId}
                </div>
              </div>

              {/* Wallet cards */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {lookedUpWallets.map((w: any, idx: number) => (
                  <div key={w.id} onClick={() => setDepositWalletId(w.id)} style={{
                    padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', minWidth: '200px',
                    border: `2px solid ${depositWalletId === w.id ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    backgroundColor: depositWalletId === w.id ? 'var(--color-primary-ghost)' : 'var(--bg-card-hover)',
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Wallet #{idx + 1}</span>
                      {w.isPrimary && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '10px', padding: '1px 6px' }}>PRIMARY</span>
                      )}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.2rem' }}>
                      {fmt(w.balance)}
                    </div>
                    <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {w.id.slice(-12).toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="deposit-amount">Deposit Amount (INR)</label>
                  <input id="deposit-amount" className="form-input" type="number" step="0.01" min="0.01"
                    placeholder="0.00" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                </div>
                <button id="confirm-deposit" className="btn btn--primary" onClick={handleDeposit} disabled={depositLoading || !depositWalletId}>
                  {depositLoading ? <span className="spinner" /> : '+ Deposit'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════ TRANSACTIONS ══════════════════════════ */}
      {activeTab === 'history' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>📜 Transaction History</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                All transfers across the system. Click a Transaction ID to copy it for use in Ledger / Verify / Audit.
              </p>
            </div>
            <button className="btn btn--primary" onClick={handleLoadTransactions} disabled={txnsLoading} style={{ flexShrink: 0 }}>
              {txnsLoading ? <><span className="spinner" /> Loading…</> : '↻ Load Transactions'}
            </button>
          </div>

          {txnsError && <div className="alert alert--error">⚠ {txnsError}</div>}

          {txns.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <input className="form-input" type="text" placeholder="Filter by ID, status, type…"
                value={txnFilter} onChange={(e) => setTxnFilter(e.target.value)}
                style={{ maxWidth: '360px' }} />
            </div>
          )}

          {txnsLoading ? (
            <div className="loading-state"><div className="spinner spinner--lg" /><span>Loading transactions…</span></div>
          ) : txns.length > 0 ? (() => {
            const q = txnFilter.toLowerCase();
            const filtered = txns.filter(t =>
              !q || t.id.toLowerCase().includes(q) || t.status.toLowerCase().includes(q) || t.type.toLowerCase().includes(q) ||
              t.sourceWalletId?.toLowerCase().includes(q) || t.targetWalletId?.toLowerCase().includes(q)
            );
            return (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Transaction ID <span style={{ opacity: 0.5 }}>(click to copy)</span></th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Source Wallet</th>
                      <th>Target Wallet</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <CopyableRow key={t.id} txn={t} fmt={fmt} fmtTime={fmtTime} shortId={shortId}
                        statusColor={statusColor} statusText={statusText} />
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="empty-state"><p className="empty-state__text">No matches for "{txnFilter}"</p></div>
                )}
              </div>
            );
          })() : (
            <div className="empty-state">
              <div className="empty-state__icon">📜</div>
              <p className="empty-state__text">Click "Load Transactions" to view all system transactions</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════ LEDGER ════════════════════════════════ */}
      {activeTab === 'ledger' && (
        <div className="card">
          <h3 style={{ marginBottom: '0.25rem', fontWeight: 700, fontSize: '1rem' }}>📒 Ledger Explorer</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Every transfer creates one DEBIT on the sender and one CREDIT on the receiver.
            Search by Wallet ID or Transaction ID to see its ledger lines.
          </p>

          {ledgerError && <div className="alert alert--error">⚠ {ledgerError}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="ledger-wallet-id">By Wallet ID (full UUID)</label>
              <input id="ledger-wallet-id" className="form-input" type="text" placeholder="Paste wallet UUID"
                value={ledgerWalletId} onChange={(e) => setLedgerWalletId(e.target.value)} />
            </div>
            <button id="ledger-by-wallet-btn" className="btn btn--ghost" onClick={handleLedgerByWallet}
              disabled={ledgerLoading || !ledgerWalletId}>
              {ledgerLoading ? <span className="spinner" /> : 'Fetch'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="ledger-txn-id">By Transaction ID (full UUID)</label>
              <input id="ledger-txn-id" className="form-input" type="text" placeholder="Paste transaction UUID"
                value={ledgerTxnId} onChange={(e) => setLedgerTxnId(e.target.value)} />
            </div>
            <button id="ledger-by-txn-btn" className="btn btn--ghost" onClick={handleLedgerByTxn}
              disabled={ledgerLoading || !ledgerTxnId}>
              {ledgerLoading ? <span className="spinner" /> : 'Fetch'}
            </button>
          </div>

          {ledgerLoading ? (
            <div className="loading-state"><div className="spinner spinner--lg" /><span>Fetching ledger…</span></div>
          ) : ledgerResults.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Type</th><th>Amount</th><th>Balance After</th><th>Wallet</th><th>Transaction</th><th>Timestamp</th></tr>
                </thead>
                <tbody>
                  {ledgerResults.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <span style={{
                          backgroundColor: e.entryType === 'CREDIT' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: e.entryType === 'CREDIT' ? '#22c55e' : '#ef4444',
                          border: `1px solid ${e.entryType === 'CREDIT' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700,
                        }}>
                          {e.entryType === 'CREDIT' ? '▲ CREDIT' : '▼ DEBIT'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmt(e.amount)}</td>
                      <td>{fmt(e.balanceAfter)}</td>
                      <td><code style={{ fontSize: '0.72rem' }}>{shortId(e.walletId)}</code></td>
                      <td><code style={{ fontSize: '0.72rem' }}>{shortId(e.transactionId)}</code></td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtTime(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">📒</div>
              <p className="empty-state__text">Enter a Wallet ID or Transaction ID above to view ledger entries</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════ RECONCILE ═════════════════════════════ */}
      {activeTab === 'reconcile' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ marginBottom: '0.25rem', fontWeight: 700, fontSize: '1rem' }}>🔄 System Reconciliation</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Compares each wallet's <strong>stored balance</strong> against <strong>ledger credits − debits</strong>.
                A mismatch means money moved without a ledger entry (e.g. admin deposits — they bypass the ledger by design in v1).
              </p>
            </div>
            <button id="run-reconcile-btn" className="btn btn--primary" onClick={handleReconcile} disabled={reconcileLoading} style={{ flexShrink: 0, marginLeft: '1rem' }}>
              {reconcileLoading ? <><span className="spinner" /> Running…</> : '🔄 Run Now'}
            </button>
          </div>

          {reconcileError && <div className="alert alert--error">⚠ {reconcileError}</div>}

          {reconcileResults.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {[
                  { label: '✅ Balanced', val: reconcileResults.filter(r => r.balanced).length, col: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' },
                  { label: '⚠ Mismatch', val: reconcileResults.filter(r => !r.balanced).length, col: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
                  { label: 'Total Wallets', val: reconcileResults.length, col: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '0.5rem 1rem', borderRadius: '6px', backgroundColor: s.col, border: `1px solid ${s.border}`, fontSize: '0.85rem' }}>
                    {s.label}: <strong style={{ color: s.text }}>{s.val}</strong>
                  </div>
                ))}
              </div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Status</th><th>Wallet ID (last 12)</th><th>Ledger Balance</th><th>Stored Balance</th><th>Difference</th></tr></thead>
                  <tbody>
                    {reconcileResults.map((r) => {
                      const diff = r.ledgerBalance - r.actualBalance;
                      return (
                        <tr key={r.walletId} style={{ backgroundColor: r.balanced ? 'transparent' : 'rgba(239,68,68,0.04)' }}>
                          <td>{r.balanced
                            ? <span style={{ color: '#22c55e', fontWeight: 600 }}>✅ OK</span>
                            : <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠ Mismatch</span>}
                          </td>
                          <td><code style={{ fontSize: '0.78rem' }}>{shortId(r.walletId)}</code></td>
                          <td>{fmt(r.ledgerBalance)}</td>
                          <td>{fmt(r.actualBalance)}</td>
                          <td style={{ color: diff !== 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: diff !== 0 ? 600 : 400 }}>
                            {diff !== 0 ? fmt(Math.abs(diff)) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!reconcileLoading && reconcileResults.length === 0 && (
            <div className="empty-state"><div className="empty-state__icon">🔄</div>
              <p className="empty-state__text">Click "Run Now" to compare all wallet balances against their ledger</p></div>
          )}
        </div>
      )}

      {/* ═══════════════════════════ VERIFY ════════════════════════════════ */}
      {activeTab === 'verify' && (
        <div className="card">
          <h3 style={{ marginBottom: '0.25rem', fontWeight: 700, fontSize: '1rem' }}>✅ Verify Transaction</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Checks that a transaction's total DEBIT = total CREDIT in the ledger (double-entry balanced).
            Get Transaction IDs from the <em>Transactions</em> tab above.
          </p>
          {verifyError && <div className="alert alert--error">⚠ {verifyError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="verify-txn-id">Transaction ID (full UUID)</label>
              <input id="verify-txn-id" className="form-input" type="text" placeholder="Paste transaction UUID"
                value={verifyTxnId} onChange={(e) => setVerifyTxnId(e.target.value)} />
            </div>
            <button id="verify-txn-btn" className="btn btn--ghost" onClick={handleVerify}
              disabled={verifyLoading || !verifyTxnId}>
              {verifyLoading ? <span className="spinner" /> : 'Verify'}
            </button>
          </div>
          {verifyResult && (
            <div style={{
              padding: '1rem 1.25rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.75rem',
              backgroundColor: verifyResult.balanced ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${verifyResult.balanced ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              <span style={{ fontSize: '1.75rem' }}>{verifyResult.balanced ? '✅' : '❌'}</span>
              <div>
                <div style={{ fontWeight: 700, color: verifyResult.balanced ? '#22c55e' : '#ef4444' }}>
                  {verifyResult.balanced ? 'Balanced — double-entry is valid' : 'Unbalanced — DEBIT ≠ CREDIT'}
                </div>
                <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{verifyResult.transactionId}</code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════ AUDIT ════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div className="card">
          <h3 style={{ marginBottom: '0.25rem', fontWeight: 700, fontSize: '1rem' }}>📋 Audit Logs</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Every action in the system is logged. Search by User ID (UUID) or Transaction ID, or load all logs.
          </p>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {[{id:'search',label:'🔍 Search'},{id:'all',label:'📋 Load All'}].map(m => (
              <button key={m.id} onClick={() => { setAuditMode(m.id as any); setAuditResults([]); setAuditError(''); }}
                className={`btn btn--sm ${auditMode === m.id ? 'btn--primary' : 'btn--ghost'}`}>
                {m.label}
              </button>
            ))}
          </div>

          {auditError && <div className="alert alert--error">⚠ {auditError}</div>}

          {auditMode === 'search' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="audit-user-id">By User ID (full UUID)</label>
                  <input id="audit-user-id" className="form-input" type="text" placeholder="Paste user UUID"
                    value={auditUserId} onChange={(e) => setAuditUserId(e.target.value)} />
                </div>
                <button id="audit-by-user-btn" className="btn btn--ghost" onClick={handleAuditByUser}
                  disabled={auditLoading || !auditUserId}>Search</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="audit-txn-id">By Transaction ID (full UUID)</label>
                  <input id="audit-txn-id" className="form-input" type="text" placeholder="Paste transaction UUID"
                    value={auditTxnId} onChange={(e) => setAuditTxnId(e.target.value)} />
                </div>
                <button id="audit-by-txn-btn" className="btn btn--ghost" onClick={handleAuditByTxn}
                  disabled={auditLoading || !auditTxnId}>Search</button>
              </div>
            </>
          ) : (
            <button className="btn btn--ghost" onClick={handleAuditAll} disabled={auditLoading} style={{ marginBottom: '1rem' }}>
              {auditLoading ? <><span className="spinner" /> Loading…</> : '↻ Load All Audit Logs'}
            </button>
          )}

          {auditLoading ? (
            <div className="loading-state"><div className="spinner spinner--lg" /><span>Loading logs…</span></div>
          ) : auditResults.length > 0 ? (
            <div className="table-container">
              <table>
                <thead><tr><th>Action</th><th>User</th><th>Transaction ID</th><th>Entity</th><th>Details</th><th>Timestamp</th></tr></thead>
                <tbody>
                  {auditResults.map((log, i) => (
                    <tr key={log.id || i}>
                      <td><span className="badge badge--info">{log.action}</span></td>
                      <td style={{ fontSize: '0.78rem' }}>
                        <div>{log.userEmail}</div>
                        <code style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{log.userId ? shortId(log.userId) : '—'}</code>
                      </td>
                      <td>
                        {log.transactionId
                          ? <CopyChip text={log.transactionId} display={shortId(log.transactionId)} />
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>{log.entityType}</td>
                      <td style={{ maxWidth: '220px', wordBreak: 'break-all', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {log.details || '—'}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtTime(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><div className="empty-state__icon">📋</div>
              <p className="empty-state__text">
                {auditMode === 'search' ? 'Enter a User ID or Transaction ID above to search' : 'Click "Load All Audit Logs" to view logs'}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CopyChip({ text, display }: { text: string; display: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button title="Click to copy full UUID" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{
        background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.1)',
        color: copied ? '#22c55e' : '#60a5fa',
        border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.25)'}`,
        borderRadius: '4px', padding: '2px 7px', fontSize: '0.72rem', fontFamily: 'monospace',
        cursor: 'pointer', transition: 'all 0.15s',
      }}>
      {copied ? '✓ Copied' : display} {!copied && <span style={{ opacity: 0.5 }}>📋</span>}
    </button>
  );
}

function CopyableRow({ txn, fmt, fmtTime, shortId, statusColor, statusText }: any) {
  const [copiedId, setCopiedId] = useState(false);
  return (
    <tr>
      <td>
        <button title="Click to copy Transaction ID" onClick={() => { navigator.clipboard.writeText(txn.id); setCopiedId(true); setTimeout(() => setCopiedId(false), 1500); }}
          style={{
            background: copiedId ? 'rgba(34,197,94,0.15)' : 'rgba(79,70,229,0.08)',
            color: copiedId ? '#22c55e' : 'var(--color-primary)',
            border: `1px solid ${copiedId ? 'rgba(34,197,94,0.3)' : 'rgba(79,70,229,0.2)'}`,
            borderRadius: '4px', padding: '3px 8px', fontSize: '0.72rem', fontFamily: 'monospace',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
          {copiedId ? '✓ Copied!' : `${shortId(txn.id)}`} {!copiedId && <span style={{ opacity: 0.5 }}>📋</span>}
        </button>
      </td>
      <td><span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{txn.type}</span></td>
      <td>
        <span style={{
          padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
          backgroundColor: statusColor[txn.status] || 'rgba(100,116,139,0.15)',
          color: statusText[txn.status] || '#94a3b8',
        }}>
          {txn.status}
        </span>
      </td>
      <td style={{ fontWeight: 600 }}>{fmt(txn.amount)}</td>
      <td><code style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{shortId(txn.sourceWalletId)}</code></td>
      <td><code style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{shortId(txn.targetWalletId)}</code></td>
      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtTime(txn.createdAt)}</td>
    </tr>
  );
}

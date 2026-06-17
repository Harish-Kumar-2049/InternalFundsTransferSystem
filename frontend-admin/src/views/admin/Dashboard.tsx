import { useState } from 'react';
import { adminAPI, auditAPI, ledgerAPI, reconcileAPI } from '../../services/api';

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  // ── Deposit ──────────────────────────────────────────────────────────────
  const [depositWalletId, setDepositWalletId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositMessage, setDepositMessage] = useState('');
  const [depositError, setDepositError] = useState('');

  // ── Lookup ───────────────────────────────────────────────────────────────
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookedUpUser, setLookedUpUser] = useState<{ userId: string; email: string; fullName: string } | null>(null);
  const [lookedUpWallets, setLookedUpWallets] = useState<any[]>([]);

  // ── Audit ────────────────────────────────────────────────────────────────
  const [auditUserId, setAuditUserId] = useState('');
  const [auditTxnId, setAuditTxnId] = useState('');
  const [auditResults, setAuditResults] = useState<unknown[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

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

  // ── Verify Transaction ────────────────────────────────────────────────────
  const [verifyTxnId, setVerifyTxnId] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ balanced: boolean; transactionId: string } | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleLookup = async (queryParam?: string) => {
    const query = queryParam || lookupQuery;
    if (!query) { setDepositError('Please enter an email or Account / Wallet ID to lookup.'); return; }
    setLookupLoading(true); setDepositError(''); setDepositMessage('');
    setLookedUpUser(null); setLookedUpWallets([]); setDepositWalletId('');
    try {
      const res = await adminAPI.lookupUserWallets(query);
      setLookedUpUser({ userId: res.data.userId, email: res.data.email, fullName: res.data.fullName });
      setLookedUpWallets(res.data.wallets);
      if (res.data.wallets?.length > 0) setDepositWalletId(res.data.wallets[0].id);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setDepositError(axiosErr.response?.data?.message || 'Lookup failed. User or wallet not found.');
    } finally { setLookupLoading(false); }
  };

  const handleDeposit = async () => {
    setDepositMessage(''); setDepositError('');
    if (!depositWalletId || !depositAmount) { setDepositError('Wallet ID and amount are required.'); return; }
    setDepositLoading(true);
    try {
      const res = await adminAPI.deposit(depositWalletId, parseFloat(depositAmount));
      setDepositMessage(res.data.message || 'Deposit successful.');
      setDepositAmount('');
      if (lookupQuery) handleLookup(lookupQuery);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setDepositError(axiosErr.response?.data?.message || 'Deposit failed.');
    } finally { setDepositLoading(false); }
  };

  const handleAuditByUser = async () => {
    if (!auditUserId) return;
    setAuditError(''); setAuditLoading(true);
    try { const res = await auditAPI.getByUser(auditUserId); setAuditResults(res.data); }
    catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setAuditError(axiosErr.response?.data?.message || 'Failed to fetch audit logs.');
    } finally { setAuditLoading(false); }
  };

  const handleAuditByTxn = async () => {
    if (!auditTxnId) return;
    setAuditError(''); setAuditLoading(true);
    try { const res = await auditAPI.getByTransaction(auditTxnId); setAuditResults(res.data); }
    catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setAuditError(axiosErr.response?.data?.message || 'Failed to fetch audit logs.');
    } finally { setAuditLoading(false); }
  };

  const handleLedgerByWallet = async () => {
    if (!ledgerWalletId) return;
    setLedgerError(''); setLedgerLoading(true); setLedgerResults([]);
    try { const res = await ledgerAPI.getByWallet(ledgerWalletId); setLedgerResults(res.data); }
    catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setLedgerError(axiosErr.response?.data?.message || 'Failed to fetch ledger entries.');
    } finally { setLedgerLoading(false); }
  };

  const handleLedgerByTxn = async () => {
    if (!ledgerTxnId) return;
    setLedgerError(''); setLedgerLoading(true); setLedgerResults([]);
    try { const res = await ledgerAPI.getByTransaction(ledgerTxnId); setLedgerResults(res.data); }
    catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setLedgerError(axiosErr.response?.data?.message || 'Failed to fetch ledger entries.');
    } finally { setLedgerLoading(false); }
  };

  const handleReconcile = async () => {
    setReconcileError(''); setReconcileLoading(true); setReconcileResults([]);
    try { const res = await reconcileAPI.runAll(); setReconcileResults(res.data); }
    catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setReconcileError(axiosErr.response?.data?.message || 'Reconciliation failed.');
    } finally { setReconcileLoading(false); }
  };

  const handleVerify = async () => {
    if (!verifyTxnId) return;
    setVerifyError(''); setVerifyLoading(true); setVerifyResult(null);
    try { const res = await reconcileAPI.verifyTransaction(verifyTxnId); setVerifyResult(res.data); }
    catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setVerifyError(axiosErr.response?.data?.message || 'Verification failed.');
    } finally { setVerifyLoading(false); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="page-header">
        <h1 className="page-header__title">Admin Control Panel</h1>
        <p className="page-header__subtitle">
          Manage wallets, deposits, ledger, reconciliation, and audit trails
        </p>
      </div>

      {/* ── Manual Deposit ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontWeight: 700, fontSize: '1rem' }}>💰 Manual Deposit</h3>

        {depositError && <div className="alert alert--error">⚠ {depositError}</div>}
        {depositMessage && <div className="alert alert--success">✓ {depositMessage}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="lookup-query">Lookup User by Email or Account / Wallet ID</label>
            <input id="lookup-query" className="form-input" type="text"
              placeholder="Enter user email or wallet UUID"
              value={lookupQuery} onChange={(e) => setLookupQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(); }} />
          </div>
          <button id="lookup-btn" className="btn btn--ghost" onClick={() => handleLookup()} disabled={lookupLoading}>
            {lookupLoading ? <span className="spinner" /> : 'Lookup'}
          </button>
        </div>

        {lookedUpUser && (
          <div style={{ borderTop: '1px solid var(--color-border, #e5e7eb)', paddingTop: '1rem', marginTop: '1rem' }}>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(59,130,246,0.05)', borderRadius: '6px' }}>
              <strong>User Found:</strong> {lookedUpUser.fullName} ({lookedUpUser.email})
              <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                ID: <code>{lookedUpUser.userId}</code>
              </span>
            </div>
            {lookedUpWallets.length === 0 ? (
              <div className="alert alert--warning">This user has no active wallets.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="deposit-wallet-select">Select Wallet to Deposit</label>
                  <select id="deposit-wallet-select" className="form-select"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--color-border, #e5e7eb)', backgroundColor: 'var(--color-bg)' }}
                    value={depositWalletId} onChange={(e) => setDepositWalletId(e.target.value)}>
                    {lookedUpWallets.map((wallet, idx) => (
                      <option key={wallet.id} value={wallet.id}>
                        Wallet #{idx + 1} ({wallet.currency}) - {fmt(wallet.balance)} {wallet.isPrimary ? '[Primary]' : ''} - ID: {wallet.id.slice(-8).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="deposit-amount">Amount</label>
                  <input id="deposit-amount" className="form-input" type="number" step="0.01" min="0.01"
                    placeholder="0.00" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                </div>
                <button id="confirm-deposit" className="btn btn--primary" onClick={handleDeposit} disabled={depositLoading}>
                  {depositLoading ? <span className="spinner" /> : 'Deposit'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Ledger Explorer ────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.25rem', fontWeight: 700, fontSize: '1rem' }}>📒 Ledger Explorer</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          View double-entry ledger records — every transfer creates one DEBIT and one CREDIT entry.
        </p>

        {ledgerError && <div className="alert alert--error">⚠ {ledgerError}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '0.75rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="ledger-wallet-id">By Wallet ID</label>
            <input id="ledger-wallet-id" className="form-input" type="text" placeholder="Wallet UUID"
              value={ledgerWalletId} onChange={(e) => setLedgerWalletId(e.target.value)} />
          </div>
          <button id="ledger-by-wallet-btn" className="btn btn--ghost" onClick={handleLedgerByWallet}
            disabled={ledgerLoading || !ledgerWalletId}>
            {ledgerLoading ? <span className="spinner" /> : 'Fetch'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="ledger-txn-id">By Transaction ID</label>
            <input id="ledger-txn-id" className="form-input" type="text" placeholder="Transaction UUID"
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
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                  <th>Wallet ID</th>
                  <th>Transaction ID</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {ledgerResults.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="badge" style={{
                        backgroundColor: e.entryType === 'CREDIT' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: e.entryType === 'CREDIT' ? '#22c55e' : '#ef4444',
                        border: `1px solid ${e.entryType === 'CREDIT' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600,
                      }}>
                        {e.entryType === 'CREDIT' ? '▲ CREDIT' : '▼ DEBIT'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{fmt(e.amount)}</td>
                    <td>{fmt(e.balanceAfter)}</td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{e.walletId.slice(-8).toUpperCase()}</td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{e.transactionId.slice(-8).toUpperCase()}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
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

      {/* ── Reconcile ───────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ marginBottom: '0.25rem', fontWeight: 700, fontSize: '1rem' }}>🔄 System Reconciliation</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              Compares each wallet's stored balance against the sum of all its ledger entries to detect discrepancies.
            </p>
          </div>
          <button id="run-reconcile-btn" className="btn btn--primary" onClick={handleReconcile} disabled={reconcileLoading}
            style={{ flexShrink: 0, marginLeft: '1rem' }}>
            {reconcileLoading ? <><span className="spinner" /> Running…</> : '🔄 Run Reconciliation'}
          </button>
        </div>

        {reconcileError && <div className="alert alert--error">⚠ {reconcileError}</div>}

        {reconcileResults.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ padding: '0.5rem 1rem', borderRadius: '6px', backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', fontSize: '0.85rem' }}>
                ✅ Balanced: <strong>{reconcileResults.filter(r => r.balanced).length}</strong>
              </div>
              <div style={{ padding: '0.5rem 1rem', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.85rem' }}>
                ⚠ Mismatched: <strong>{reconcileResults.filter(r => !r.balanced).length}</strong>
              </div>
              <div style={{ padding: '0.5rem 1rem', borderRadius: '6px', backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', fontSize: '0.85rem' }}>
                Total wallets: <strong>{reconcileResults.length}</strong>
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Wallet ID</th>
                    <th>Ledger Balance</th>
                    <th>Stored Balance</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {reconcileResults.map((r) => {
                    const diff = r.ledgerBalance - r.actualBalance;
                    return (
                      <tr key={r.walletId} style={{ backgroundColor: r.balanced ? 'transparent' : 'rgba(239,68,68,0.04)' }}>
                        <td>
                          {r.balanced
                            ? <span style={{ color: '#22c55e', fontWeight: 600 }}>✅ OK</span>
                            : <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠ Mismatch</span>}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{r.walletId.slice(-12).toUpperCase()}</td>
                        <td>{fmt(r.ledgerBalance)}</td>
                        <td>{fmt(r.actualBalance)}</td>
                        <td style={{ color: diff !== 0 ? '#ef4444' : 'var(--color-text-muted)', fontWeight: diff !== 0 ? 600 : 400 }}>
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
          <div className="empty-state">
            <div className="empty-state__icon">🔄</div>
            <p className="empty-state__text">Click "Run Reconciliation" to check all wallet balances against the ledger</p>
          </div>
        )}
      </div>

      {/* ── Verify Transaction ──────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.25rem', fontWeight: 700, fontSize: '1rem' }}>✅ Verify Transaction</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          Confirms that a transaction's total DEBIT equals total CREDIT (double-entry balanced).
        </p>

        {verifyError && <div className="alert alert--error">⚠ {verifyError}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="verify-txn-id">Transaction ID</label>
            <input id="verify-txn-id" className="form-input" type="text" placeholder="Transaction UUID"
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
            <span style={{ fontSize: '1.5rem' }}>{verifyResult.balanced ? '✅' : '❌'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: verifyResult.balanced ? '#22c55e' : '#ef4444' }}>
                {verifyResult.balanced ? 'Balanced — Transaction is valid' : 'Unbalanced — Ledger mismatch detected!'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                {verifyResult.transactionId}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Audit Logs ──────────────────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem', fontWeight: 700, fontSize: '1rem' }}>📋 Audit Log Lookup</h3>

        {auditError && <div className="alert alert--error">⚠ {auditError}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="audit-user-id">By User ID</label>
            <input id="audit-user-id" className="form-input" type="text" placeholder="User UUID"
              value={auditUserId} onChange={(e) => setAuditUserId(e.target.value)} />
          </div>
          <button id="audit-by-user-btn" className="btn btn--ghost" onClick={handleAuditByUser}
            disabled={auditLoading || !auditUserId}>Search</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1.5rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="audit-txn-id">By Transaction ID</label>
            <input id="audit-txn-id" className="form-input" type="text" placeholder="Transaction UUID"
              value={auditTxnId} onChange={(e) => setAuditTxnId(e.target.value)} />
          </div>
          <button id="audit-by-txn-btn" className="btn btn--ghost" onClick={handleAuditByTxn}
            disabled={auditLoading || !auditTxnId}>Search</button>
        </div>

        {auditLoading ? (
          <div className="loading-state"><div className="spinner spinner--lg" /><span>Searching audit logs…</span></div>
        ) : auditResults.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Action</th><th>Entity Type</th><th>Details</th><th>Timestamp</th></tr>
              </thead>
              <tbody>
                {auditResults.map((log: unknown, i: number) => {
                  const entry = log as { id?: string; action?: string; entityType?: string; details?: string; createdAt?: string };
                  return (
                    <tr key={entry.id || i}>
                      <td><span className="badge badge--info">{entry.action}</span></td>
                      <td>{entry.entityType}</td>
                      <td style={{ maxWidth: '300px', wordBreak: 'break-all', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {entry.details || '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <p className="empty-state__text">Search by User ID or Transaction ID to view audit logs</p>
          </div>
        )}
      </div>
    </>
  );
}

import { useState, useEffect } from 'react';
import { walletAPI, transactionAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface Wallet {
  id: string;
  balance: number;
  currency: string;
  status: string;
  isPrimary: boolean;
  createdAt: string;
}

interface TransferForm {
  sourceWalletId: string;
  recipientIdentifier: string;
  amount: string;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // Transfer modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferForm>({
    sourceWalletId: '',
    recipientIdentifier: '',
    amount: '',
  });
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');

  // Create wallet
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const res = await walletAPI.getMyWallets();
      setWallets(res.data);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err) {
        setError((err as { message: string }).message);
      } else {
        setError('Failed to load wallets.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  const handleCreateWallet = async () => {
    setCreateLoading(true);
    try {
      await walletAPI.create();
      setShowCreateWallet(false);
      fetchWallets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Failed to create wallet.');
      } else {
        setError('Failed to create wallet.');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSetPrimary = async (walletId: string) => {
    try {
      setError('');
      await walletAPI.setPrimary(walletId);
      fetchWallets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Failed to update primary wallet.');
      } else {
        setError('Failed to update primary wallet.');
      }
    }
  };

  const handleTransfer = async () => {
    setTransferError('');
    setTransferSuccess('');

    if (!transferForm.sourceWalletId || !transferForm.recipientIdentifier || !transferForm.amount) {
      setTransferError('All fields are required.');
      return;
    }

    setTransferLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      await transactionAPI.transfer({
        sourceWalletId: transferForm.sourceWalletId,
        recipientIdentifier: transferForm.recipientIdentifier,
        amount: parseFloat(transferForm.amount),
        idempotencyKey,
      });
      setTransferSuccess('Transfer completed successfully!');
      setTransferForm({ sourceWalletId: '', recipientIdentifier: '', amount: '' });
      fetchWallets();
      setTimeout(() => {
        setShowTransfer(false);
        setTransferSuccess('');
      }, 1500);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setTransferError(axiosErr.response?.data?.message || 'Transfer failed.');
      } else {
        setTransferError('Transfer failed. Check your connection.');
      }
    } finally {
      setTransferLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const shortId = (id: string) => id.slice(-8).toUpperCase();

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

  return (
    <>
      <div className="page-header">
         <h1 className="page-header__title">Dashboard</h1>
         <p className="page-header__subtitle">
           Welcome back, {user?.email}
         </p>
         {user?.userId && (
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
             <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>User ID:</span>
             <button
               id="copy-user-id"
               title="Click to copy User ID"
               onClick={() => {
                 navigator.clipboard.writeText(user.userId);
                 setCopiedId(true);
                 setTimeout(() => setCopiedId(false), 1500);
               }}
               style={{
                 display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                 fontSize: '0.78rem', fontFamily: 'monospace',
                 backgroundColor: copiedId ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.1)',
                 color: copiedId ? '#22c55e' : 'var(--color-primary)',
                 border: `1px solid ${copiedId ? 'rgba(34,197,94,0.4)' : 'rgba(59,130,246,0.3)'}`,
                 borderRadius: '20px', padding: '2px 10px',
                 cursor: 'pointer', transition: 'all 0.2s ease',
               }}
             >
               {copiedId ? '✓ Copied!' : `${user.userId.slice(0, 8)}…${user.userId.slice(-4)}`}
               {!copiedId && <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>📋</span>}
             </button>
           </div>
         )}
       </div>
 
       {error && <div className="alert alert--error">⚠ {error}</div>}
 
       <div className="alert alert--info" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.9rem' }}>
         <span>ℹ</span>
         <span>You will receive money in your primary wallet.</span>
       </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">💰</div>
          <div className="stat-card__label">Total Balance</div>
          <div className="stat-card__value">{formatCurrency(totalBalance)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--success">👛</div>
          <div className="stat-card__label">Active Wallets</div>
          <div className="stat-card__value">{wallets.filter(w => w.status === 'ACTIVE').length}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          id="create-wallet-btn"
          className="btn btn--primary"
          onClick={() => setShowCreateWallet(true)}
        >
          + New Wallet
        </button>
        <button
          id="transfer-btn"
          className="btn btn--ghost"
          onClick={() => setShowTransfer(true)}
          disabled={wallets.length === 0}
        >
          Send Money
        </button>
      </div>

      {/* Wallet Grid */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner spinner--lg" />
          <span>Loading wallets...</span>
        </div>
      ) : wallets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">👛</div>
          <p className="empty-state__text">No wallets yet. Create your first wallet to get started!</p>
        </div>
      ) : (
        <div className="wallet-grid">
          {wallets.map((wallet, idx) => (
            <div className="wallet-card" key={wallet.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span className="wallet-card__currency">Wallet #{idx + 1}</span>
                {wallet.isPrimary && (
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}>Primary</span>
                )}
              </div>
              <div className="wallet-card__balance">
                {formatCurrency(wallet.balance)}
              </div>
              <div className="wallet-card__id" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem', wordBreak: 'break-all' }}>
                <strong>Acct No:</strong> {shortId(wallet.id)}<br/>
                <strong>Wallet ID:</strong> {wallet.id}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <span className={`wallet-card__status wallet-card__status--${wallet.status.toLowerCase()}`}>
                  {wallet.status}
                </span>
                {!wallet.isPrimary && wallet.status === 'ACTIVE' && (
                  <button
                    className="btn btn--ghost btn--sm"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', border: '1px solid var(--color-border)' }}
                    onClick={() => handleSetPrimary(wallet.id)}
                  >
                    Set Primary
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Wallet Modal */}
      {showCreateWallet && (
        <div className="modal-overlay" onClick={() => setShowCreateWallet(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Create New Wallet</h2>
              <button className="modal__close" onClick={() => setShowCreateWallet(false)}>✕</button>
            </div>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              A new INR wallet will be created for your account.
            </p>
            <button
              id="confirm-create-wallet"
              className="btn btn--primary btn--full"
              onClick={handleCreateWallet}
              disabled={createLoading}
            >
              {createLoading ? <span className="spinner" /> : 'Create Wallet'}
            </button>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="modal-overlay" onClick={() => setShowTransfer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Send Money</h2>
              <button className="modal__close" onClick={() => { setShowTransfer(false); setTransferError(''); setTransferSuccess(''); }}>✕</button>
            </div>

            {transferError && <div className="alert alert--error">⚠ {transferError}</div>}
            {transferSuccess && <div className="alert alert--success">✓ {transferSuccess}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="transfer-source">From Wallet</label>
              <select
                id="transfer-source"
                className="form-select"
                value={transferForm.sourceWalletId}
                onChange={(e) => setTransferForm({ ...transferForm, sourceWalletId: e.target.value })}
              >
                <option value="">Select source wallet</option>
                {wallets.filter(w => w.status === 'ACTIVE').map((w, idx) => (
                  <option key={w.id} value={w.id}>
                    Wallet #{idx + 1} – {formatCurrency(w.balance)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="transfer-recipient">Recipient Email or Account ID</label>
              <input
                id="transfer-recipient"
                className="form-input"
                type="text"
                placeholder="Enter email or user ID"
                value={transferForm.recipientIdentifier}
                onChange={(e) => setTransferForm({ ...transferForm, recipientIdentifier: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="transfer-amount">Amount</label>
              <input
                id="transfer-amount"
                className="form-input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
              />
            </div>

            <button
              id="confirm-transfer"
              className="btn btn--primary btn--full"
              onClick={handleTransfer}
              disabled={transferLoading}
            >
              {transferLoading ? <span className="spinner" /> : 'Send'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

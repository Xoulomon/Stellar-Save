import React, { useState } from 'react'
import { TransactionStatus, ContributeButtonProps } from '../types/contribution'

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record
  TransactionStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  idle: {
    label: 'Contribute',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    className: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  confirming: {
    label: 'Confirm in Wallet',
    icon: (
      <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    className: 'bg-yellow-500 text-white cursor-wait',
  },
  pending: {
    label: 'Processing...',
    icon: (
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    ),
    className: 'bg-yellow-500 text-white cursor-wait',
  },
  submitting: {
    label: 'Submitting...',
    icon: (
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    ),
    className: 'bg-blue-500 text-white cursor-wait',
  },
  success: {
    label: 'Contributed!',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    className: 'bg-green-500 text-white',
  },
  error: {
    label: 'Try Again',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    className: 'bg-red-500 hover:bg-red-600 text-white',
  },
}

// ── Confirmation Modal ──────────────────────────────────────────────────────

interface ConfirmModalProps {
  amount: number
  cycleId: number
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({ amount, cycleId, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in">
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900">Confirm Contribution</h3>
          <p className="text-gray-500 text-sm mt-1">Cycle #{cycleId}</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Amount</span>
            <span className="font-bold text-gray-900">{amount} XLM</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-500">Network fee</span>
            <span className="text-gray-600">~0.00001 XLM</span>
          </div>
          <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between">
            <span className="font-semibold text-gray-700">Total</span>
            <span className="font-bold text-indigo-600">{amount} XLM</span>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mb-4">
          Your wallet will prompt you to approve this transaction.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-medium text-white transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Transaction Status Banner ───────────────────────────────────────────────

interface StatusBannerProps {
  status: TransactionStatus
  txHash?: string
  errorMessage?: string
  onDismiss: () => void
}

function StatusBanner({ status, txHash, errorMessage, onDismiss }: StatusBannerProps) {
  if (status === 'idle' || status === 'confirming') return null

  const banners = {
    pending: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', msg: 'Waiting for wallet confirmation...' },
    submitting: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', msg: 'Submitting transaction to network...' },
    success: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', msg: 'Transaction confirmed! ✓' },
    error: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', msg: errorMessage || 'Transaction failed. Please try again.' },
  }

  const banner = banners[status as keyof typeof banners]
  if (!banner) return null

  return (
    <div className={`mt-3 p-3 rounded-xl border ${banner.bg} flex items-start justify-between`}>
      <div>
        <p className={`text-sm font-medium ${banner.text}`}>{banner.msg}</p>
        {txHash && status === 'success' && (
          
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-500 hover:underline mt-0.5 block"
          >
            View on Explorer →
          </a>
        )}
      </div>
      {(status === 'success' || status === 'error') && (
        <button onClick={onDismiss} className={`text-sm ${banner.text} hover:opacity-70`}>✕</button>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

async function mockWalletTransaction(amount: number): Promise<string> {
  // Simulates wallet interaction + network submission
  // Replace with actual Freighter/Stellar SDK call
  await new Promise((r) => setTimeout(r, 1500))
  if (Math.random() < 0.1) throw new Error('User rejected the request')
  await new Promise((r) => setTimeout(r, 1000))
  return `tx_${Math.random().toString(36).substr(2, 16)}`
}

export function ContributeButton({
  amount,
  cycleId,
  walletAddress,
  onSuccess,
  onError,
  disabled = false,
}: ContributeButtonProps) {
  const [status, setStatus] = useState<TransactionStatus>('idle')
  const [showConfirm, setShowConfirm] = useState(false)
  const [txHash, setTxHash] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()

  const isLoading = ['confirming', 'pending', 'submitting'].includes(status)
  const isDisabled = disabled || isLoading || status === 'success' || !walletAddress

  const handleClick = () => {
    if (status === 'error') {
      setStatus('idle')
      setErrorMessage(undefined)
      return
    }
    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    setShowConfirm(false)
    setStatus('confirming')
    try {
      setStatus('pending')
      const hash = await mockWalletTransaction(amount)
      setStatus('submitting')
      await new Promise((r) => setTimeout(r, 800))
      setTxHash(hash)
      setStatus('success')
      onSuccess?.(hash)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Transaction failed')
      setErrorMessage(error.message)
      setStatus('error')
      onError?.(error)
    }
  }

  const config = STATUS_CONFIG[status]

  return (
    <div className="w-full">
      {!walletAddress && (
        <p className="text-xs text-amber-600 mb-2 text-center">
          ⚠️ Connect your wallet to contribute
        </p>
      )}

      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${config.className}`}
      >
        {config.icon}
        {config.label}
        {status === 'idle' && (
          <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
            {amount} XLM
          </span>
        )}
      </button>

      <StatusBanner
        status={status}
        txHash={txHash}
        errorMessage={errorMessage}
        onDismiss={() => setStatus('idle')}
      />

      {showConfirm && (
        <ConfirmModal
          amount={amount}
          cycleId={cycleId}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}

export default ContributeButton

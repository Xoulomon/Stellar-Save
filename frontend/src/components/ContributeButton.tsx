import { useState } from "react";
import type { ContributeButtonProps } from "../types/contribution";
import { ContributionSuccessModal } from "./ContributionSuccessModal";
import { useTransaction, explorerUrl } from "../hooks/useTransaction";
import { useContract } from "../hooks/useContract";

// ── Confirmation Modal ──────────────────────────────────────────────────────

function ConfirmModal({
  amount,
  cycleId,
  onConfirm,
  onCancel,
}: {
  amount: number;
  cycleId: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Confirm Contribution</h3>
        <p className="text-gray-500 text-sm text-center mb-4">Cycle #{cycleId}</p>
        <div className="bg-gray-50 rounded-xl p-4 mb-5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Amount</span>
            <span className="font-bold text-gray-900">{amount} XLM</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-500">Network fee</span>
            <span className="text-gray-600">~0.00001 XLM</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-medium text-white"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function ContributeButton({
  amount,
  cycleId,
  walletAddress,
  onSuccess,
  onError: _onError,
  disabled = false,
}: ContributeButtonProps) {
  const { state, txHash, error, execute, reset } = useTransaction();
  const { contribute } = useContract();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const isPending = state === "pending";
  const isDisabled = disabled || isPending || state === "confirmed" || !walletAddress;

  const handleClick = () => {
    if (state === "failed") { reset(); return; }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    await execute(async () => {
      const result = await contribute({
        groupId: BigInt(cycleId),
        amount: BigInt(Math.round(amount * 10_000_000)),
      });
      if (result.error) throw new Error(result.error.message);
      return result.txHash!;
    });
  };

  // Note: state is read after execute resolves
  const buttonLabel =
    state === "pending" ? "Processing…" :
    state === "confirmed" ? "Contributed!" :
    state === "failed" ? "Try Again" :
    "Contribute";

  const buttonClass =
    state === "pending" ? "bg-yellow-500 text-white cursor-wait" :
    state === "confirmed" ? "bg-green-500 text-white" :
    state === "failed" ? "bg-red-500 hover:bg-red-600 text-white" :
    "bg-indigo-600 hover:bg-indigo-700 text-white";

  // Fire callbacks after state settles
  if (state === "confirmed" && txHash && !showSuccess) {
    // handled via showSuccess flag below
  }

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
        className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${buttonClass}`}
      >
        {isPending && (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {buttonLabel}
        {state === "idle" && (
          <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">{amount} XLM</span>
        )}
      </button>

      {state === "confirmed" && txHash && (
        <div className="mt-3 p-3 rounded-xl border bg-green-50 border-green-200">
          <p className="text-sm font-medium text-green-700">Transaction confirmed! ✓</p>
          <a
            href={explorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-500 hover:underline mt-0.5 block"
          >
            View on Explorer →
          </a>
        </div>
      )}

      {state === "failed" && error && (
        <div className="mt-3 p-3 rounded-xl border bg-red-50 border-red-200 flex items-start justify-between">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button onClick={reset} className="text-sm text-red-700 hover:opacity-70 ml-2">✕</button>
        </div>
      )}

      {showConfirm && (
        <ConfirmModal
          amount={amount}
          cycleId={cycleId}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <ContributionSuccessModal
        open={showSuccess}
        amount={amount}
        cycleId={cycleId}
        txHash={txHash ?? undefined}
        onClose={() => {
          setShowSuccess(false);
          reset();
          onSuccess?.(txHash ?? "");
        }}
      />
    </div>
  );
}

export default ContributeButton;

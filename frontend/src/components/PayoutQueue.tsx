import React, { useRef } from "react"
import { PayoutQueueData, PayoutEntry, PayoutStatus } from "../types/contribution"

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const STATUS_CONFIG: Record<PayoutStatus, { label: string; rowClass: string; badgeClass: string; dot: string }> = {
  completed: {
    label: "Paid",
    rowClass: "bg-gray-50 border-gray-200 opacity-75",
    badgeClass: "bg-gray-100 text-gray-500",
    dot: "bg-gray-400",
  },
  next: {
    label: "Next",
    rowClass: "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200",
    badgeClass: "bg-indigo-100 text-indigo-700 font-bold animate-pulse",
    dot: "bg-indigo-500",
  },
  upcoming: {
    label: "Upcoming",
    rowClass: "bg-white border-gray-100",
    badgeClass: "bg-yellow-50 text-yellow-600",
    dot: "bg-yellow-400",
  },
}

function PayoutRow({
  entry,
  isCurrentUser,
}: {
  entry: PayoutEntry
  isCurrentUser: boolean
}) {
  const config = STATUS_CONFIG[entry.status]

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${config.rowClass} ${
        isCurrentUser ? "ring-2 ring-purple-300" : ""
      }`}
    >
      {/* Position number */}
      <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0 shadow-sm">
        {entry.position}
      </div>

      {/* Status dot */}
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${config.dot}`} />

      {/* Member info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {entry.memberName || formatAddress(entry.memberAddress)}
          </p>
          {isCurrentUser && (
            <span className="text-xs text-purple-600 font-semibold flex-shrink-0">(you)</span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {entry.status === "completed" && entry.paidAt
            ? `Paid on ${formatDate(entry.paidAt)}`
            : `Est. ${formatDate(entry.estimatedDate)}`}
        </p>
        {entry.txHash && (
          
            href={`https://stellar.expert/explorer/testnet/tx/${entry.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-500 hover:underline"
          >
            View transaction
          </a>
        )}
      </div>

      {/* Amount + badge */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-sm font-bold text-gray-800">{entry.amount} XLM</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${config.badgeClass}`}>
          {config.label}
        </span>
      </div>
    </div>
  )
}

interface PayoutQueueProps {
  data: PayoutQueueData
  maxHeight?: number
}

export function PayoutQueue({ data, maxHeight = 480 }: PayoutQueueProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const completed = data.entries.filter((e) => e.status === "completed")
  const next = data.entries.find((e) => e.status === "next")
  const upcoming = data.entries.filter((e) => e.status === "upcoming")
  const completedCount = completed.length
  const progress = (completedCount / data.totalMembers) * 100

  const scrollToNext = () => {
    const el = scrollRef.current?.querySelector("[data-next]")
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Payout Queue</h2>
            <p className="text-indigo-200 text-sm">Cycle #{data.cycleId}</p>
          </div>
          <button
            onClick={scrollToNext}
            className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full transition-colors font-medium"
          >
            Jump to Next
          </button>
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-indigo-200 mb-1">
            <span>{completedCount} of {data.totalMembers} paid out</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-1.5">
            <div
              className="bg-white h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scrollable list */}
      <div
        ref={scrollRef}
        className="overflow-y-auto px-4 py-3 space-y-2"
        style={{ maxHeight }}
      >
        {/* Completed */}
        {completed.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
              Completed ({completed.length})
            </p>
            {completed.map((entry) => (
              <div key={entry.position} className="mb-2">
                <PayoutRow
                  entry={entry}
                  isCurrentUser={entry.memberAddress === data.currentUserAddress}
                />
              </div>
            ))}
          </div>
        )}

        {/* Next */}
        {next && (
          <div data-next>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2 px-1">
              Next Payout
            </p>
            <div className="mb-2">
              <PayoutRow
                entry={next}
                isCurrentUser={next.memberAddress === data.currentUserAddress}
              />
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
              Upcoming ({upcoming.length})
            </p>
            {upcoming.map((entry) => (
              <div key={entry.position} className="mb-2">
                <PayoutRow
                  entry={entry}
                  isCurrentUser={entry.memberAddress === data.currentUserAddress}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-5 py-3 flex justify-between text-xs text-gray-400">
        <span>{data.totalMembers} total members</span>
        <span>{upcoming.length + (next ? 1 : 0)} remaining</span>
      </div>
    </div>
  )
}

export default PayoutQueue

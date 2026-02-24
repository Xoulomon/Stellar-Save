import React, { useState, useEffect } from 'react'
import { ContributionCycle, Member } from '../types/contribution'

interface ContributionStatusProps {
  cycle: ContributionCycle
  currentUserAddress?: string
  onRefresh?: () => void
  refreshInterval?: number // ms
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTimeLeft(deadline: Date): string {
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  if (diff <= 0) return 'Deadline passed'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

function DeadlineBadge({ deadline }: { deadline: Date }) {
  const [timeLeft, setTimeLeft] = useState(formatTimeLeft(deadline))
  const diff = deadline.getTime() - new Date().getTime()
  const isUrgent = diff < 1000 * 60 * 60 * 24 // < 24 hours

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(formatTimeLeft(deadline))
    }, 60000)
    return () => clearInterval(interval)
  }, [deadline])

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
        isUrgent
          ? 'bg-red-100 text-red-700 animate-pulse'
          : 'bg-yellow-100 text-yellow-700'
      }`}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {timeLeft}
    </span>
  )
}

function MemberRow({ member, isCurrentUser }: { member: Member; isCurrentUser: boolean }) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
        member.contributed
          ? 'bg-green-50 border-green-200'
          : 'bg-red-50 border-red-200'
      } ${isCurrentUser ? 'ring-2 ring-indigo-400' : ''}`}
    >
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <div
          className={`w-3 h-3 rounded-full flex-shrink-0 ${
            member.contributed ? 'bg-green-500' : 'bg-red-400'
          }`}
        />
        {/* Address / name */}
        <div>
          <p className="text-sm font-medium text-gray-800">
            {member.name || formatAddress(member.address)}
            {isCurrentUser && (
              <span className="ml-2 text-xs text-indigo-600 font-semibold">(you)</span>
            )}
          </p>
          {member.contributed && member.contributedAt && (
            <p className="text-xs text-gray-500">
              Contributed {member.contributedAt.toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {member.amount !== undefined && member.contributed && (
          <span className="text-sm font-semibold text-green-700">
            {member.amount.toFixed(2)} XLM
          </span>
        )}
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            member.contributed
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-600'
          }`}
        >
          {member.contributed ? '✓ Paid' : '✗ Pending'}
        </span>
      </div>
    </div>
  )
}

export function ContributionStatus({
  cycle,
  currentUserAddress,
  onRefresh,
  refreshInterval = 30000,
}: ContributionStatusProps) {
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const progress = (cycle.contributedCount / cycle.totalMembers) * 100
  const contributed = cycle.members.filter((m) => m.contributed)
  const pending = cycle.members.filter((m) => !m.contributed)

  // Auto-refresh
  useEffect(() => {
    if (!onRefresh) return
    const interval = setInterval(() => {
      onRefresh()
      setLastUpdated(new Date())
    }, refreshInterval)
    return () => clearInterval(interval)
  }, [onRefresh, refreshInterval])

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Cycle #{cycle.cycleId}</h2>
            <p className="text-indigo-200 text-sm">Contribution Status</p>
          </div>
          <div className="flex items-center gap-2">
            <DeadlineBadge deadline={cycle.deadline} />
            {onRefresh && (
              <button
                onClick={() => { onRefresh(); setLastUpdated(new Date()) }}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                title="Refresh"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600">
            {cycle.contributedCount} of {cycle.totalMembers} contributed
          </span>
          <span className="text-sm font-bold text-indigo-600">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-gradient-to-r from-indigo-500 to-green-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Target: {cycle.targetAmount} XLM</span>
          <span>Updated {lastUpdated.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Members */}
      <div className="px-6 py-4 space-y-4">
        {/* Contributed */}
        {contributed.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
              Contributed ({contributed.length})
            </h3>
            <div className="space-y-2">
              {contributed.map((m) => (
                <MemberRow
                  key={m.address}
                  member={m}
                  isCurrentUser={m.address === currentUserAddress}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1">
              <span className="w-2 h-2 bg-red-400 rounded-full inline-block" />
              Pending ({pending.length})
            </h3>
            <div className="space-y-2">
              {pending.map((m) => (
                <MemberRow
                  key={m.address}
                  member={m}
                  isCurrentUser={m.address === currentUserAddress}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ContributionStatus

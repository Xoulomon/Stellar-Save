import React, { useState } from "react"
import { MemberCardData, MemberStatus } from "../types/contribution"

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getInitials(name?: string, address?: string): string {
  if (name) return name.slice(0, 2).toUpperCase()
  return address ? address.slice(0, 2).toUpperCase() : "??"
}

const STATUS_CONFIG: Record<MemberStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-100 text-green-700" },
  inactive: { label: "Inactive", className: "bg-gray-100 text-gray-500" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  removed: { label: "Removed", className: "bg-red-100 text-red-600" },
}

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-purple-500", "bg-pink-500",
  "bg-blue-500", "bg-teal-500", "bg-orange-500",
]

function getAvatarColor(address: string): string {
  const idx = address.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function StatItem({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {sub && <p className="text-xs text-indigo-500">{sub}</p>}
    </div>
  )
}

interface MemberCardProps {
  member: MemberCardData
  isCurrentUser?: boolean
  compact?: boolean
  onClick?: (member: MemberCardData) => void
}

export function MemberCard({ member, isCurrentUser = false, compact = false, onClick }: MemberCardProps) {
  const [copied, setCopied] = useState(false)
  const statusConfig = STATUS_CONFIG[member.status]
  const avatarColor = getAvatarColor(member.address)

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(member.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const positionOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"]
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  if (compact) {
    return (
      <div
        onClick={() => onClick?.(member)}
        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
          isCurrentUser ? "border-indigo-300 bg-indigo-50" : "border-gray-100 bg-white hover:border-gray-200"
        } ${onClick ? "cursor-pointer" : ""}`}
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${avatarColor}`}>
          {getInitials(member.name, member.address)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {member.name || formatAddress(member.address)}
            </p>
            {isCurrentUser && <span className="text-xs text-indigo-500">(you)</span>}
          </div>
          <p className="text-xs text-gray-500">{member.contributionCount} contributions</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusConfig.className}`}>
          {statusConfig.label}
        </span>
      </div>
    )
  }

  return (
    <div
      onClick={() => onClick?.(member)}
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 ${
        isCurrentUser ? "border-indigo-300 ring-2 ring-indigo-100" : "border-gray-100 hover:shadow-md"
      } ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="relative bg-gradient-to-r from-indigo-50 to-purple-50 px-5 pt-5 pb-10">
        <div className="absolute top-4 right-4">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusConfig.className}`}>
            {statusConfig.label}
          </span>
        </div>
        {isCurrentUser && (
          <div className="absolute top-4 left-4">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">You</span>
          </div>
        )}
      </div>

      <div className="flex justify-center -mt-8 mb-3">
        <div className={`w-16 h-16 rounded-full border-4 border-white shadow flex items-center justify-center text-white text-xl font-bold ${avatarColor}`}>
          {getInitials(member.name, member.address)}
        </div>
      </div>

      <div className="text-center px-5 mb-4">
        {member.name && <h3 className="font-bold text-gray-900 text-base">{member.name}</h3>}
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <p className="text-sm text-gray-500 font-mono">{formatAddress(member.address)}</p>
          <button onClick={handleCopyAddress} className="text-gray-400 hover:text-indigo-500 transition-colors" title="Copy address">
            {copied ? (
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">Joined {formatDate(member.joinDate)}</p>
      </div>

      <div className="border-t border-gray-100 mx-5" />

      <div className="grid grid-cols-3 gap-2 px-5 py-4">
        <StatItem label="Contributions" value={member.contributionCount} />
        <StatItem label="Total Paid" value={`${member.totalContributed} XLM`} />
        <StatItem
          label="Payout Position"
          value={positionOrdinal(member.payoutPosition)}
          sub={member.hasReceivedPayout ? "Received" : `of ${member.totalMembers}`}
        />
      </div>

      <div className="px-5 pb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Payout queue</span>
          <span>{member.payoutPosition} / {member.totalMembers}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${member.hasReceivedPayout ? "bg-green-400" : "bg-indigo-400"}`}
            style={{ width: `${(member.payoutPosition / member.totalMembers) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default MemberCard

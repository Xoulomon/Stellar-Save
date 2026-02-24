import React, { useState } from 'react'
import { ContributionStatus } from './ContributionStatus'
import { ContributionCycle } from '../types/contribution'

const MOCK_CYCLE: ContributionCycle = {
  cycleId: 3,
  deadline: new Date(Date.now() + 1000 * 60 * 60 * 18), // 18 hours from now
  totalMembers: 5,
  contributedCount: 3,
  targetAmount: 500,
  members: [
    {
      address: 'GBVXR3LNBKWJQZB5XQXM3Y3VXQZB5XQXM3Y3VX',
      name: 'Alice',
      contributed: true,
      contributedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      amount: 100,
    },
    {
      address: 'GCVXR3LNBKWJQZB5XQXM3Y3VXQZB5XQXM3Y3VX',
      name: 'Bob',
      contributed: true,
      contributedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
      amount: 100,
    },
    {
      address: 'GDVXR3LNBKWJQZB5XQXM3Y3VXQZB5XQXM3Y3VX',
      name: 'Carol',
      contributed: true,
      contributedAt: new Date(Date.now() - 1000 * 60 * 30),
      amount: 100,
    },
    {
      address: 'GEVXR3LNBKWJQZB5XQXM3Y3VXQZB5XQXM3Y3VX',
      name: 'Dave',
      contributed: false,
    },
    {
      address: 'GFVXR3LNBKWJQZB5XQXM3Y3VXQZB5XQXM3Y3VX',
      name: 'Eve',
      contributed: false,
    },
  ],
}

export default function ContributionStatusDemo() {
  const [cycle, setCycle] = useState(MOCK_CYCLE)

  const handleRefresh = () => {
    // Simulate real-time update
    setCycle((prev) => ({ ...prev }))
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <ContributionStatus
          cycle={cycle}
          currentUserAddress="GEVXR3LNBKWJQZB5XQXM3Y3VXQZB5XQXM3Y3VX"
          onRefresh={handleRefresh}
          refreshInterval={30000}
        />
      </div>
    </div>
  )
}

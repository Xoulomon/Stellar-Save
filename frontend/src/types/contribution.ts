export interface Member {
  address: string
  name?: string
  contributed: boolean
  contributedAt?: Date
  amount?: number
}

export interface ContributionCycle {
  cycleId: number
  deadline: Date
  totalMembers: number
  contributedCount: number
  members: Member[]
  targetAmount: number
}

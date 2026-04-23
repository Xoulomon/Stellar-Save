/**
 * Cycle progress calculation utility for Stellar Save groups.
 * Calculates time-based and contribution-based progress percentages.
 * Handles edge cases like unstarted cycles, zero duration, invalid dates.
 */

export interface CycleProgressResult {
  /**
   * Time progress: (elapsed / cycleDuration) * 100, clamped 0-100
   */
  timeProgress: number;
  
  /**
   * Contribution progress: (contributed / totalMembers) * 100, clamped 0-100
   */
  contributionProgress: number;
  
  /**
   * Overall progress: min(timeProgress, contributionProgress)
   * - Cycle completes when both time is up AND all contributions received
   */
  overallProgress: number;
  
  /**
   * True if cycleDuration elapsed and all contributions received
   */
  isComplete: boolean;
  
  /**
   * True if time elapsed > cycleDuration
   */
  isOverdue: boolean;
  
  /**
   * Human-readable time remaining (null if ended)
   */
  timeRemaining: string | null;
  
  /**
   * Time elapsed in seconds
   */
  elapsedSeconds: number;
}

/**
 * Calculate cycle progress given start time, duration, and contribution stats.
 * 
 * @param params - Cycle parameters
 * @returns Structured progress data
 * @throws Error if cycleDuration <= 0
 */
export function calculateCycleProgress(params: {
  /**
   * When cycle started (UTC Date). If null, assumes not started (0% time).
   */
  cycleStart: Date | null;
  
  /**
   * Cycle length in seconds. Must be > 0.
   */
  cycleDurationSeconds: number;
  
  /**
   * Number of members who contributed (clamped to 0-totalMembers).
   */
  contributedCount: number;
  
  /**
   * Total group members. Must be > 0.
   */
  totalMembers: number;
  
  /**
   * Calculate at this time (defaults to now).
   */
  now?: Date;
}): CycleProgressResult {
  const now = params.now ?? new Date();
  
  // Unstarted cycle — return all zeros
  if (!params.cycleStart) {
    if (params.cycleDurationSeconds <= 0) throw new Error('Cycle duration must be greater than 0');
    if (params.totalMembers <= 0) throw new Error('Total members must be greater than 0');
    return {
      timeProgress: 0,
      contributionProgress: Math.min(100, Math.max(0, (params.contributedCount / params.totalMembers) * 100)),
      overallProgress: 0,
      isComplete: false,
      isOverdue: false,
      timeRemaining: null,
      elapsedSeconds: 0,
    };
  }

  const elapsedMs = Math.max(0, now.getTime() - params.cycleStart.getTime());
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  
  // Validate inputs
  if (params.cycleDurationSeconds <= 0) {
    throw new Error('Cycle duration must be greater than 0');
  }
  if (params.totalMembers <= 0) {
    throw new Error('Total members must be greater than 0');
  }
  
  // Time progress: clamp 0-100
  const timeProgressRaw = (elapsedSeconds / params.cycleDurationSeconds) * 100;
  const timeProgress = Math.min(100, Math.max(0, timeProgressRaw));
  
  // Contribution progress: clamp 0-100
  const contribProgressRaw = (params.contributedCount / params.totalMembers) * 100;
  const contributionProgress = Math.min(100, Math.max(0, contribProgressRaw));
  
  // Overall: min of both (cycle needs both time + full contributions)
  const overallProgress = Math.min(timeProgress, contributionProgress);
  
  const isOverdue = elapsedSeconds > params.cycleDurationSeconds;
  const isComplete = overallProgress === 100;
  
  // Time remaining
  let timeRemaining: string | null = null;
  if (!isOverdue && params.cycleStart) {
    const remainingSeconds = params.cycleDurationSeconds - elapsedSeconds;
    const days = Math.floor(remainingSeconds / (24 * 60 * 60));
    const hours = Math.floor((remainingSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((remainingSeconds % (60 * 60)) / 60);
    
    if (days > 0) {
      timeRemaining = `${days}d ${hours}h`;
    } else if (hours > 0) {
      timeRemaining = `${hours}h ${minutes}m`;
    } else {
      timeRemaining = `${minutes}m`;
    }
  }
  
  return {
    timeProgress,
    contributionProgress,
    overallProgress,
    isComplete,
    isOverdue,
    timeRemaining,
    elapsedSeconds,
  };
}

// Convenience overload using deadline (common in UI)
export function calculateCycleProgressFromDeadline(
  deadline: Date,
  contributedCount: number,
  totalMembers: number,
  now?: Date
): CycleProgressResult {
  const cycleStart = new Date(deadline.getTime() - (30 * 24 * 60 * 60 * 1000)); // Assume 30-day cycles
  return calculateCycleProgress({
    cycleStart,
    cycleDurationSeconds: 30 * 24 * 60 * 60, // 30 days
    contributedCount,
    totalMembers,
    now
  });
}


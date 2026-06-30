import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  StreakDisplay,
  getEarnedBadges,
  getNextMilestone,
  STREAK_BADGES,
} from "../components/StreakDisplay";

describe("getEarnedBadges", () => {
  it("returns no badges for streak < 5", () => {
    expect(getEarnedBadges(4)).toHaveLength(0);
  });

  it("returns Starter badge at 5", () => {
    const badges = getEarnedBadges(5);
    expect(badges).toHaveLength(1);
    expect(badges[0].label).toBe("Starter");
  });

  it("returns all 4 badges at 50", () => {
    expect(getEarnedBadges(50)).toHaveLength(4);
  });

  it("returns correct badges at 10", () => {
    const badges = getEarnedBadges(10);
    expect(badges.map((b) => b.label)).toEqual(["Starter", "Consistent"]);
  });

  it("returns all badges above 50", () => {
    expect(getEarnedBadges(100)).toHaveLength(4);
  });
});

describe("getNextMilestone", () => {
  it("returns Starter as next milestone at 0", () => {
    expect(getNextMilestone(0)?.label).toBe("Starter");
  });

  it("returns Consistent as next milestone at 5", () => {
    expect(getNextMilestone(5)?.label).toBe("Consistent");
  });

  it("returns null when all badges earned", () => {
    expect(getNextMilestone(50)).toBeNull();
  });

  it("returns Legend as next milestone at 20", () => {
    expect(getNextMilestone(20)?.label).toBe("Legend");
  });
});

describe("StreakDisplay", () => {
  it("renders the streak display", () => {
    render(<StreakDisplay currentStreak={3} longestStreak={7} />);
    expect(screen.getByTestId("streak-display")).toBeInTheDocument();
  });

  it("shows current streak value", () => {
    render(<StreakDisplay currentStreak={12} longestStreak={15} />);
    expect(screen.getByTestId("current-streak")).toHaveTextContent("12");
  });

  it("shows longest streak value", () => {
    render(<StreakDisplay currentStreak={12} longestStreak={15} />);
    expect(screen.getByTestId("longest-streak")).toHaveTextContent("15");
  });

  it("shows no-badges message when streak < 5", () => {
    render(<StreakDisplay currentStreak={3} longestStreak={3} />);
    expect(screen.getByTestId("no-badges")).toBeInTheDocument();
  });

  it("does not show no-badges message when badges earned", () => {
    render(<StreakDisplay currentStreak={5} longestStreak={5} />);
    expect(screen.queryByTestId("no-badges")).not.toBeInTheDocument();
  });

  it("shows earned badges section when streak >= 5", () => {
    render(<StreakDisplay currentStreak={5} longestStreak={5} />);
    expect(screen.getByTestId("streak-badges")).toBeInTheDocument();
    expect(screen.getByTestId("badge-5")).toBeInTheDocument();
  });

  it("shows all 4 badges at streak 50", () => {
    render(<StreakDisplay currentStreak={50} longestStreak={50} />);
    STREAK_BADGES.forEach((b) => {
      expect(screen.getByTestId(`badge-${b.threshold}`)).toBeInTheDocument();
    });
  });

  it("shows progress bar toward next milestone", () => {
    render(<StreakDisplay currentStreak={3} longestStreak={3} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-valuemax", "5");
    expect(bar).toHaveAttribute("aria-valuenow", "3");
  });

  it("progress bar shows 100% and no progress bar when all badges earned", () => {
    render(<StreakDisplay currentStreak={50} longestStreak={50} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows correct progress percentage", () => {
    render(<StreakDisplay currentStreak={5} longestStreak={5} />);
    // Next milestone is Consistent at 10, so 5/10 = 50%
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("does not show warning by default", () => {
    render(<StreakDisplay currentStreak={5} longestStreak={5} />);
    expect(screen.queryByTestId("streak-warning")).not.toBeInTheDocument();
  });

  it("shows streak warning when atRisk is true", () => {
    render(<StreakDisplay currentStreak={5} longestStreak={5} atRisk />);
    expect(screen.getByTestId("streak-warning")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("applies at-risk CSS class when atRisk", () => {
    render(<StreakDisplay currentStreak={5} longestStreak={5} atRisk />);
    expect(screen.getByTestId("streak-display")).toHaveClass("streak-display--at-risk");
  });

  it("shows contribution count in progress", () => {
    render(<StreakDisplay currentStreak={7} longestStreak={7} />);
    expect(screen.getByText("7 / 10 contributions")).toBeInTheDocument();
  });
});

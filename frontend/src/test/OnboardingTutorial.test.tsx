import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { useState } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { OnboardingTutorial, useOnboardingTutorial } from "../components/OnboardingTutorial";


expect.extend(toHaveNoViolations);

beforeEach(() => {
  localStorage.clear();
});

describe("OnboardingTutorial", () => {
  it("renders the tutorial overlay on first visit", () => {
    render(<OnboardingTutorial />);
    expect(screen.getByTestId("onboarding-tutorial")).toBeInTheDocument();
  });

  it("does not render when already completed", () => {
    localStorage.setItem("stellar-save-onboarding-complete", "true");
    render(<OnboardingTutorial />);
    expect(screen.queryByTestId("onboarding-tutorial")).not.toBeInTheDocument();
  });

  it("shows forceShow even when completed", () => {
    localStorage.setItem("stellar-save-onboarding-complete", "true");
    render(<OnboardingTutorial forceShow />);
    expect(screen.getByTestId("onboarding-tutorial")).toBeInTheDocument();
  });

  it("shows step 1 content initially", () => {
    render(<OnboardingTutorial />);
    expect(screen.getByText("Welcome to Stellar-Save")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
  });

  it("advances to next step on Next click", () => {
    render(<OnboardingTutorial />);
    fireEvent.click(screen.getByLabelText("Next step"));
    expect(screen.getByText("Create or Join a Group")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
  });

  it("goes back to previous step on Back click", () => {
    render(<OnboardingTutorial />);
    fireEvent.click(screen.getByLabelText("Next step"));
    fireEvent.click(screen.getByLabelText("Previous step"));
    expect(screen.getByText("Welcome to Stellar-Save")).toBeInTheDocument();
  });

  it("Back button is disabled on first step", () => {
    render(<OnboardingTutorial />);
    expect(screen.getByLabelText("Previous step")).toBeDisabled();
  });

  it("shows Get Started on last step", () => {
    render(<OnboardingTutorial />);
    // Navigate to last step
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: /next step/i }));
    }
    expect(screen.getByLabelText("Finish tutorial")).toBeInTheDocument();
    expect(screen.getByText("Get Started")).toBeInTheDocument();
  });

  it("hides tutorial and saves to localStorage on finish", () => {
    render(<OnboardingTutorial />);
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: /next step/i }));
    }
    fireEvent.click(screen.getByLabelText("Finish tutorial"));
    expect(screen.queryByTestId("onboarding-tutorial")).not.toBeInTheDocument();
    expect(localStorage.getItem("stellar-save-onboarding-complete")).toBe("true");
  });

  it("calls onComplete callback when finished", () => {
    const onComplete = vi.fn();
    render(<OnboardingTutorial onComplete={onComplete} />);
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: /next step/i }));
    }
    fireEvent.click(screen.getByLabelText("Finish tutorial"));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("skips tutorial and saves to localStorage", () => {
    render(<OnboardingTutorial />);
    fireEvent.click(screen.getByLabelText("Skip tutorial"));
    expect(screen.queryByTestId("onboarding-tutorial")).not.toBeInTheDocument();
    expect(localStorage.getItem("stellar-save-onboarding-complete")).toBe("true");
  });

  it("navigates to a specific step via dot buttons", () => {
    render(<OnboardingTutorial />);
    fireEvent.click(screen.getByLabelText("Go to step 3"));
    expect(screen.getByText("Make Contributions")).toBeInTheDocument();
  });

  it("renders all 5 dot navigation buttons", () => {
    render(<OnboardingTutorial />);
    expect(screen.getAllByRole("button", { name: /Go to step/i })).toHaveLength(5);
  });

  it("active dot has aria-current=step", () => {
    render(<OnboardingTutorial />);
    const firstDot = screen.getByLabelText("Go to step 1");
    expect(firstDot).toHaveAttribute("aria-current", "step");
  });

  it("has no axe violations", async () => {
    const { container } = render(<OnboardingTutorial />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("dialog has role=dialog, aria-modal, aria-labelledby and aria-describedby", () => {
    render(<OnboardingTutorial />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "onboarding-title");
    expect(dialog).toHaveAttribute("aria-describedby", "onboarding-description");
    expect(document.getElementById("onboarding-title")).toHaveTextContent("Welcome to Stellar-Save");
  });

  it("moves focus into the dialog when opened", () => {
    render(<OnboardingTutorial />);
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  });

  it("Tab cycles focus within the dialog and wraps around", async () => {
    const user = userEvent.setup();
    render(<OnboardingTutorial />);

    const skip = screen.getByLabelText("Skip tutorial");
    const back = screen.getByLabelText("Previous step");
    const next = screen.getByLabelText("Next step");

    // Skip is the first focusable element in the dialog.
    expect(document.activeElement).toBe(skip);

    // Shift+Tab from the first element wraps to the last (Next).
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(next);

    // Tab from the last element wraps back to the first (Skip).
    await user.tab();
    expect(document.activeElement).toBe(skip);

    expect(back).toBeDisabled();
  });

  it("closes the tutorial on Escape and saves completion", () => {
    render(<OnboardingTutorial />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("onboarding-tutorial")).not.toBeInTheDocument();
    expect(localStorage.getItem("stellar-save-onboarding-complete")).toBe("true");
  });

  it("restores focus to the triggering element when dismissed via Skip", () => {
    localStorage.setItem("stellar-save-onboarding-complete", "true");

    function Harness() {
      const [show, setShow] = useState(false);
      return (
        <div>
          <button onClick={() => setShow(true)}>Replay tutorial</button>
          <OnboardingTutorial forceShow={show} />
        </div>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: /replay tutorial/i });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByTestId("onboarding-tutorial")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Skip tutorial"));

    expect(screen.queryByTestId("onboarding-tutorial")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("useOnboardingTutorial", () => {
  it("replay clears the completed flag", () => {
    localStorage.setItem("stellar-save-onboarding-complete", "true");
    const { result } = renderHook(() => useOnboardingTutorial());
    act(() => result.current.replay());
    expect(localStorage.getItem("stellar-save-onboarding-complete")).toBe("false");
  });
});

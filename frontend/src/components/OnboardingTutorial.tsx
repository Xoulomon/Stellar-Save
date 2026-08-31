import { useState, useRef, useCallback, useEffect } from "react";

import { useFocusTrap } from "../hooks/useFocusTrap";
import { useLocalStorage } from "../hooks/useLocalStorage";
import "./OnboardingTutorial.css";

const STORAGE_KEY = "stellar-save-onboarding-complete";

interface TutorialStep {
  title: string;
  description: string;
  icon: string;
}

const STEPS: TutorialStep[] = [
  {
    title: "Welcome to Stellar-Save",
    description:
      "Stellar-Save is a decentralized rotating savings group (ROSCA) built on Stellar. Members contribute regularly and take turns receiving the full pool.",
    icon: "🌟",
  },
  {
    title: "Create or Join a Group",
    description:
      "Create a new savings group by setting a contribution amount, cycle duration, and max members — or browse existing groups to join one.",
    icon: "👥",
  },
  {
    title: "Make Contributions",
    description:
      "Each cycle, contribute your fixed amount using your Stellar wallet. All contributions are recorded transparently on-chain.",
    icon: "💰",
  },
  {
    title: "Receive Payouts",
    description:
      "When all members contribute, the full pool is automatically paid out to the next member in rotation. No coordinator needed.",
    icon: "🎉",
  },
  {
    title: "Track Your Progress",
    description:
      "Monitor your contribution streaks, view group timelines, and stay on top of upcoming deadlines from your dashboard.",
    icon: "📊",
  },
];

export interface OnboardingTutorialProps {
  /** Force the tutorial to show regardless of localStorage state */
  forceShow?: boolean;
  onComplete?: () => void;
}

export function OnboardingTutorial({
  forceShow = false,
  onComplete,
}: OnboardingTutorialProps) {
  const [completed, setCompleted] = useLocalStorage<boolean>(
    STORAGE_KEY,
    false,
  );
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const showTutorial = !((completed && !forceShow) || !visible);

  function finish() {
    setCompleted(true);
    setVisible(false);
    onComplete?.();
  }

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => setStep((s) => Math.max(0, s - 1));

  const handleSkip = () => {
    finish();
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Trap Tab/Shift+Tab within the dialog while visible and restore focus to
  // the triggering element once the tutorial is dismissed.
  useFocusTrap(dialogRef, showTutorial);

  useEffect(() => {
    if (!showTutorial) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showTutorial, handleKeyDown]);

  if (!showTutorial) return null;

  return (
    <div
      ref={dialogRef}
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-description"
      data-testid="onboarding-tutorial"
    >
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <span className="onboarding-step-count">
            Step {step + 1} of {STEPS.length}
          </span>
          <button
            className="onboarding-skip"
            onClick={handleSkip}
            aria-label="Skip tutorial"
          >
            Skip
          </button>
        </div>

        <div className="onboarding-body">
          <div className="onboarding-icon" aria-hidden="true">
            {current.icon}
          </div>
          <h2 id="onboarding-title" className="onboarding-title">{current.title}</h2>
          <p id="onboarding-description" className="onboarding-description">{current.description}</p>
        </div>

        <div className="onboarding-dots" aria-label="Tutorial progress">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`onboarding-dot${i === step ? " onboarding-dot--active" : ""}`}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === step ? "step" : undefined}
            />
          ))}
        </div>

        <div className="onboarding-footer">
          <button
            className="onboarding-btn onboarding-btn--secondary"
            onClick={handlePrev}
            disabled={step === 0}
            aria-label="Previous step"
          >
            Back
          </button>
          <button
            className="onboarding-btn onboarding-btn--primary"
            onClick={handleNext}
            aria-label={isLast ? "Finish tutorial" : "Next step"}
          >
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Hook to programmatically replay the tutorial */
export function useOnboardingTutorial() {
  const [, setCompleted] = useLocalStorage<boolean>(STORAGE_KEY, false);
  const replay = () => setCompleted(false);
  return { replay };
}

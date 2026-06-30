import { useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  validateFormStep,
  validateAndTransformFormData,
  VALIDATION_CONSTANTS,
} from "../schemas/groupSchema";
import type { GroupData } from "../utils/groupApi";
import "./CreateGroupForm.css";

export const CYCLE_DURATION_OPTIONS = [
  { value: "604800", label: "Weekly" },
  { value: "1209600", label: "Bi-Weekly" },
  { value: "2592000", label: "Monthly" },
] as const;

const STEPS = [
  { label: "Basics" },
  { label: "Finances" },
  { label: "Members" },
  { label: "Insurance" },
  { label: "Review" },
] as const;

const DRAFT_KEY = "create-group-draft";

interface FormData {
  name: string;
  description: string;
  imageUrl: string;
  contributionAmount: string;
  cycleDuration: string;
  maxMembers: string;
  minMembers: string;
  insuranceEnabled: boolean;
  insurancePremiumRate: string;
}

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  imageUrl: "",
  contributionAmount: "",
  cycleDuration: "",
  maxMembers: "",
  minMembers: "2",
  insuranceEnabled: false,
  insurancePremiumRate: "5",
};

type FormErrors = Record<string, string | undefined>;

interface CreateGroupFormProps {
  onSubmit: (data: GroupData) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function CreateGroupForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CreateGroupFormProps) {
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<FormErrors>({});
  const [draftSaved, setDraftSaved] = useState(false);

  const [draft, setDraft] = useLocalStorage<FormData>(DRAFT_KEY, EMPTY_FORM);
  const [formData, setFormData] = useState<FormData>(draft);

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setDraftSaved(false);
  };

  const runValidateStep = (currentStep: number): boolean => {
    if (currentStep === 4) {
      // Insurance step: validate premium only when enabled
      const newErrors: FormErrors = {};
      if (formData.insuranceEnabled && formData.insurancePremiumRate) {
        const rate = parseFloat(formData.insurancePremiumRate);
        if (isNaN(rate) || rate < 0 || rate > 100) {
          newErrors["insurancePremiumRate"] = "Premium must be between 0 and 100 %";
        }
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }
    const formDataRecord = formData as unknown as Record<string, string>;
    const newErrors = validateFormStep(currentStep, formDataRecord);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (runValidateStep(step)) setStep((prev) => prev + 1);
  };

  const handleBack = () => setStep((prev) => prev - 1);

  const handleSaveDraft = () => {
    setDraft(formData);
    setDraftSaved(true);
  };

  const handleDiscardDraft = () => {
    setDraft(EMPTY_FORM);
    setFormData(EMPTY_FORM);
    setStep(1);
    setErrors({});
    setDraftSaved(false);
  };

  const handleSubmit = () => {
    if (runValidateStep(3)) {
      const formDataRecord: Record<string, string | boolean> = {
        name: formData.name,
        description: formData.description,
        imageUrl: formData.imageUrl,
        contributionAmount: formData.contributionAmount,
        cycleDuration: formData.cycleDuration,
        maxMembers: formData.maxMembers,
        minMembers: formData.minMembers,
        insuranceEnabled: formData.insuranceEnabled,
        insurancePremiumRate: formData.insurancePremiumRate,
      };

      const result = validateAndTransformFormData(formDataRecord);

      if (!result.success) {
        setErrors(result.errors);
        return;
      }

      setDraft(EMPTY_FORM);
      onSubmit(result.data);
    }
  };

  const hasDraft = JSON.stringify(formData) !== JSON.stringify(EMPTY_FORM);
  const TOTAL_STEPS = STEPS.length;

  return (
    <div className="create-group-form">
      {/* Step progress indicator */}
      <nav aria-label="Form progress" className="wizard-steps">
        {STEPS.map((s, i) => {
          const stepNum = i + 1;
          const state =
            stepNum < step ? "completed" : stepNum === step ? "current" : "upcoming";
          return (
            <div key={s.label} className={`wizard-step wizard-step--${state}`}>
              <span className="wizard-step__number" aria-hidden="true">
                {stepNum < step ? "✓" : stepNum}
              </span>
              <span className="wizard-step__label">{s.label}</span>
            </div>
          );
        })}
      </nav>

      <p className="form-step-label" aria-live="polite">
        Step {step} of {TOTAL_STEPS} — {STEPS[step - 1].label}
      </p>

      {/* Step 1: Basic Information */}
      {step === 1 && (
        <div className="form-step">
          <h2>Basic Information</h2>
          <Input
            label="Group Name"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            error={errors["name"]}
            required
            aria-required="true"
            disabled={isSubmitting}
            helperText={`Name should be 3–${VALIDATION_CONSTANTS.GROUP_NAME_MAX} characters (e.g. "Family Savings Circle")`}
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => updateField("description", e.target.value)}
            error={errors["description"]}
            required
            aria-required="true"
            disabled={isSubmitting}
            helperText={`Describe the group's purpose (max ${VALIDATION_CONSTANTS.GROUP_DESCRIPTION_MAX} characters)`}
          />
          <Input
            label="Image URL (Optional)"
            type="url"
            value={formData.imageUrl}
            onChange={(e) => updateField("imageUrl", e.target.value)}
            error={errors["imageUrl"]}
            helperText="URL to a group image for visual identification"
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Step 2: Financial Settings */}
      {step === 2 && (
        <div className="form-step">
          <h2>Financial Settings</h2>
          <Input
            label="Contribution Amount (XLM)"
            type="number"
            value={formData.contributionAmount}
            onChange={(e) => updateField("contributionAmount", e.target.value)}
            error={errors["contributionAmount"]}
            helperText={`Amount each member contributes per cycle — between ${VALIDATION_CONSTANTS.MIN_CONTRIBUTION_XLM} and ${VALIDATION_CONSTANTS.MAX_CONTRIBUTION_XLM} XLM (e.g. 100 XLM)`}
            required
            aria-required="true"
            disabled={isSubmitting}
          />
          <div className="input-wrapper">
            <label htmlFor="cycleDuration" className="input-label">
              Cycle Duration <span aria-hidden="true">*</span>
            </label>
            <p className="input-helper">
              How often contributions are collected — weekly works well for small groups, monthly for larger ones
            </p>
            <select
              id="cycleDuration"
              className={`cycle-select${errors["cycleDuration"] ? " cycle-select--error" : ""}`}
              value={formData.cycleDuration}
              onChange={(e) => updateField("cycleDuration", e.target.value)}
              aria-required="true"
              aria-invalid={errors["cycleDuration"] ? "true" : undefined}
              disabled={isSubmitting}
            >
              <option value="">Select cycle duration</option>
              {CYCLE_DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors["cycleDuration"] && (
              <span className="input-error" role="alert">
                {errors["cycleDuration"]}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Group Settings */}
      {step === 3 && (
        <div className="form-step">
          <h2>Group Settings</h2>
          <Input
            label="Maximum Members"
            type="number"
            value={formData.maxMembers}
            onChange={(e) => updateField("maxMembers", e.target.value)}
            error={errors["maxMembers"]}
            helperText={`Maximum number of group members (${VALIDATION_CONSTANTS.MIN_MEMBERS}–${VALIDATION_CONSTANTS.MAX_MEMBERS_LIMIT})`}
            required
            aria-required="true"
            disabled={isSubmitting}
          />
          <Input
            label="Minimum Members"
            type="number"
            value={formData.minMembers}
            onChange={(e) => updateField("minMembers", e.target.value)}
            error={errors["minMembers"]}
            helperText={`Minimum members needed to start first cycle (at least ${VALIDATION_CONSTANTS.MIN_MEMBERS})`}
            required
            aria-required="true"
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Step 4: Insurance Pool */}
      {step === 4 && (
        <div className="form-step">
          <h2>Insurance Pool</h2>
          <p className="form-step-description">
            An insurance pool protects members if someone misses a contribution.
            A small premium (% of each contribution) is collected into the pool.
            Claims can be made by members in hardship situations.
          </p>

          <div className="insurance-toggle-row">
            <label className="insurance-toggle-label" htmlFor="insuranceEnabled">
              Enable insurance pool for this group
            </label>
            <input
              id="insuranceEnabled"
              type="checkbox"
              className="insurance-toggle"
              checked={formData.insuranceEnabled}
              onChange={(e) => updateField("insuranceEnabled", e.target.checked)}
              disabled={isSubmitting}
              aria-describedby="insurance-hint"
            />
          </div>
          <p id="insurance-hint" className="input-helper">
            Members will be informed of the premium cost before joining.
          </p>

          {formData.insuranceEnabled && (
            <Input
              label="Premium Rate (%)"
              type="number"
              value={formData.insurancePremiumRate}
              onChange={(e) => updateField("insurancePremiumRate", e.target.value)}
              error={errors["insurancePremiumRate"]}
              helperText="Percentage of each contribution collected into the insurance pool (0–100 %). Typical: 3–10 %."
              disabled={isSubmitting}
            />
          )}

          {formData.insuranceEnabled && (
            <div className="insurance-cost-preview" aria-live="polite">
              {formData.contributionAmount && formData.insurancePremiumRate ? (
                <p>
                  At a <strong>{formData.insurancePremiumRate}%</strong> premium on a{" "}
                  <strong>{formData.contributionAmount} XLM</strong> contribution, each member
                  pays an extra{" "}
                  <strong>
                    {(
                      (parseFloat(formData.contributionAmount) *
                        parseFloat(formData.insurancePremiumRate)) /
                      100
                    ).toFixed(4)}{" "}
                    XLM
                  </strong>{" "}
                  per cycle into the insurance pool.
                </p>
              ) : (
                <p>Enter a contribution amount (Step 2) to see the per-cycle cost.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div className="form-step">
          <h2>Review &amp; Confirm</h2>
          <div className="review-section">
            <div className="review-item">
              <span className="review-label">Group Name:</span>
              <span>{formData.name}</span>
            </div>
            <div className="review-item">
              <span className="review-label">Description:</span>
              <span>{formData.description}</span>
            </div>
            {formData.imageUrl && (
              <div className="review-item">
                <span className="review-label">Image URL:</span>
                <span>{formData.imageUrl}</span>
              </div>
            )}
            <div className="review-item">
              <span className="review-label">Contribution:</span>
              <span>{formData.contributionAmount} XLM</span>
            </div>
            <div className="review-item">
              <span className="review-label">Cycle Duration:</span>
              <span>
                {CYCLE_DURATION_OPTIONS.find((o) => o.value === formData.cycleDuration)?.label ??
                  formData.cycleDuration}
              </span>
            </div>
            <div className="review-item">
              <span className="review-label">Maximum Members:</span>
              <span>{formData.maxMembers}</span>
            </div>
            <div className="review-item">
              <span className="review-label">Minimum Members:</span>
              <span>{formData.minMembers}</span>
            </div>
            <div className="review-item">
              <span className="review-label">Insurance Pool:</span>
              <span>
                {formData.insuranceEnabled
                  ? `Enabled — ${formData.insurancePremiumRate}% premium per cycle`
                  : "Disabled"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="form-actions">
        {hasDraft && step < TOTAL_STEPS && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            aria-label="Save draft"
          >
            {draftSaved ? "Draft saved ✓" : "Save Draft"}
          </Button>
        )}
        {hasDraft && step === 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDiscardDraft}
            disabled={isSubmitting}
            aria-label="Discard draft"
          >
            Discard Draft
          </Button>
        )}
        {step > 1 && (
          <Button variant="secondary" onClick={handleBack} disabled={isSubmitting}>
            Back
          </Button>
        )}
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        {step < TOTAL_STEPS ? (
          <Button onClick={handleNext} disabled={isSubmitting}>
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={isSubmitting}>
            Create Group
          </Button>
        )}
      </div>
    </div>
  );
}

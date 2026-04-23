import { useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import type { GroupData } from "../utils/groupApi";
import "./CreateGroupForm.css";

export const CYCLE_DURATION_OPTIONS = [
  { value: "604800", label: "Weekly" },
  { value: "1209600", label: "Bi-Weekly" },
  { value: "2592000", label: "Monthly" },
] as const;

interface FormData {
  name: string;
  description: string;
  imageUrl: string;
  contributionAmount: string;
  cycleDuration: string;
  maxMembers: string;
  minMembers: string;
}

type FormErrors = Record<string, string | undefined>;

interface CreateGroupFormProps {
  onSubmit: (data: GroupData) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function validateStep(
  currentStep: number,
  formData: FormData,
): FormErrors {
  const newErrors: FormErrors = {};

  if (currentStep === 1) {
    if (!formData.name.trim() || formData.name.trim().length < 3) {
      newErrors.name = "Group name must be at least 3 characters";
    } else if (formData.name.trim().length > 50) {
      newErrors.name = "Group name must be 50 characters or fewer";
    }
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    } else if (formData.description.trim().length > 500) {
      newErrors.description = "Description must be 500 characters or fewer";
    }
  }

  if (currentStep === 2) {
    const amount = parseFloat(formData.contributionAmount);
    if (!formData.contributionAmount || isNaN(amount) || amount <= 0) {
      newErrors.contributionAmount =
        "Contribution amount must be greater than 0";
    }
    if (!formData.cycleDuration) {
      newErrors.cycleDuration = "Cycle duration is required";
    }
  }

  if (currentStep === 3) {
    const max = parseInt(formData.maxMembers);
    const min = parseInt(formData.minMembers);
    if (!formData.maxMembers || isNaN(max) || max < 2) {
      newErrors.maxMembers = "Maximum members must be at least 2";
    }
    if (!formData.minMembers || isNaN(min) || min < 2) {
      newErrors.minMembers = "Minimum members must be at least 2";
    }
    if (!newErrors.maxMembers && !newErrors.minMembers && max < min) {
      newErrors.maxMembers =
        "Maximum members must be greater than or equal to minimum members";
    }
  }

  return newErrors;
}

export function CreateGroupForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CreateGroupFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    imageUrl: "",
    contributionAmount: "",
    cycleDuration: "",
    maxMembers: "",
    minMembers: "2",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const runValidateStep = (currentStep: number): boolean => {
    const newErrors = validateStep(currentStep, formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (runValidateStep(step)) {
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => setStep((prev) => prev - 1);

  const handleSubmit = () => {
    if (runValidateStep(3)) {
      onSubmit({
        name: formData.name.trim(),
        description: formData.description.trim(),
        image_url: formData.imageUrl.trim(),
        contribution_amount: Math.round(
          parseFloat(formData.contributionAmount) * 10_000_000,
        ),
        cycle_duration: parseInt(formData.cycleDuration),
        max_members: parseInt(formData.maxMembers),
        min_members: parseInt(formData.minMembers),
      });
    }
  };

  return (
    <div className="create-group-form">
      <div
        className="form-progress"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={4}
        aria-label={`Step ${step} of 4`}
      >
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`progress-step ${s <= step ? "active" : ""}`}
          />
        ))}
      </div>
      <p className="form-step-label">Step {step} of 4</p>

      {step === 1 && (
        <div className="form-step">
          <h2>Basic Information</h2>
          <Input
            label="Group Name"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            error={errors.name}
            required
            aria-required="true"
            disabled={isSubmitting}
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => updateField("description", e.target.value)}
            error={errors.description}
            required
            aria-required="true"
            disabled={isSubmitting}
          />
          <Input
            label="Image URL (Optional)"
            type="url"
            value={formData.imageUrl}
            onChange={(e) => updateField("imageUrl", e.target.value)}
            error={errors.imageUrl}
            helperText="URL to a group image for visual identification"
            disabled={isSubmitting}
          />
        </div>
      )}

      {step === 2 && (
        <div className="form-step">
          <h2>Financial Settings</h2>
          <Input
            label="Contribution Amount (XLM)"
            type="number"
            value={formData.contributionAmount}
            onChange={(e) => updateField("contributionAmount", e.target.value)}
            error={errors.contributionAmount}
            helperText="Amount each member contributes per cycle"
            required
            aria-required="true"
            disabled={isSubmitting}
          />
          <div className="input-wrapper">
            <label htmlFor="cycleDuration" className="input-label">
              Cycle Duration <span aria-hidden="true">*</span>
            </label>
            <select
              id="cycleDuration"
              className={`cycle-select${errors.cycleDuration ? " cycle-select--error" : ""}`}
              value={formData.cycleDuration}
              onChange={(e) => updateField("cycleDuration", e.target.value)}
              aria-required="true"
              aria-invalid={errors.cycleDuration ? "true" : undefined}
              aria-describedby={
                errors.cycleDuration ? "cycleDuration-error" : undefined
              }
              disabled={isSubmitting}
            >
              <option value="">Select cycle duration</option>
              {CYCLE_DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.cycleDuration && (
              <span
                id="cycleDuration-error"
                className="input-error"
                role="alert"
              >
                {errors.cycleDuration}
              </span>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="form-step">
          <h2>Group Settings</h2>
          <Input
            label="Maximum Members"
            type="number"
            value={formData.maxMembers}
            onChange={(e) => updateField("maxMembers", e.target.value)}
            error={errors.maxMembers}
            helperText="Maximum number of members allowed"
            required
            aria-required="true"
            disabled={isSubmitting}
          />
          <Input
            label="Minimum Members"
            type="number"
            value={formData.minMembers}
            onChange={(e) => updateField("minMembers", e.target.value)}
            error={errors.minMembers}
            helperText="Minimum members needed to start"
            required
            aria-required="true"
            disabled={isSubmitting}
          />
        </div>
      )}

      {step === 4 && (
        <div className="form-step">
          <h2>Review & Confirm</h2>
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
                {CYCLE_DURATION_OPTIONS.find(
                  (o) => o.value === formData.cycleDuration,
                )?.label ?? formData.cycleDuration}
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
          </div>
        </div>
      )}

      <div className="form-actions">
        {step > 1 && (
          <Button
            variant="secondary"
            onClick={handleBack}
            disabled={isSubmitting}
          >
            Back
          </Button>
        )}
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        {step < 4 ? (
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

import { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import './CreateGroupForm.css';

interface FormData {
  name: string;
  description: string;
  contributionAmount: string;
  cycleDuration: string;
  maxMembers: string;
  minMembers: string;
}

interface CreateGroupFormProps {
  onSubmit: (data: FormData) => void;
  onCancel?: () => void;
}

export function CreateGroupForm({ onSubmit, onCancel }: CreateGroupFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    contributionAmount: '',
    cycleDuration: '',
    maxMembers: '',
    minMembers: '2',
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Partial<FormData> = {};

    if (currentStep === 1) {
      if (!formData.name.trim()) newErrors.name = 'Group name is required';
      if (!formData.description.trim()) newErrors.description = 'Description is required';
    }

    if (currentStep === 2) {
      const amount = parseFloat(formData.contributionAmount);
      if (!formData.contributionAmount || amount <= 0) {
        newErrors.contributionAmount = 'Valid contribution amount required';
      }
      const duration = parseInt(formData.cycleDuration);
      if (!formData.cycleDuration || duration <= 0) {
        newErrors.cycleDuration = 'Valid cycle duration required';
      }
    }

    if (currentStep === 3) {
      const max = parseInt(formData.maxMembers);
      const min = parseInt(formData.minMembers);
      if (!formData.maxMembers || max < 2) {
        newErrors.maxMembers = 'Max members must be at least 2';
      }
      if (!formData.minMembers || min < 2) {
        newErrors.minMembers = 'Min members must be at least 2';
      }
      if (max && min && max < min) {
        newErrors.maxMembers = 'Max must be greater than or equal to min';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => setStep(prev => prev - 1);

  const handleSubmit = () => {
    if (validateStep(3)) {
      onSubmit(formData);
    }
  };

  return (
    <div className="create-group-form">
      <div className="form-progress">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`progress-step ${s <= step ? 'active' : ''}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="form-step">
          <h2>Basic Information</h2>
          <Input
            label="Group Name"
            value={formData.name}
            onChange={e => updateField('name', e.target.value)}
            error={errors.name}
            required
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={e => updateField('description', e.target.value)}
            error={errors.description}
            required
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
            onChange={e => updateField('contributionAmount', e.target.value)}
            error={errors.contributionAmount}
            helperText="Amount each member contributes per cycle"
            required
          />
          <Input
            label="Cycle Duration (seconds)"
            type="number"
            value={formData.cycleDuration}
            onChange={e => updateField('cycleDuration', e.target.value)}
            error={errors.cycleDuration}
            helperText="Time between payouts (e.g., 604800 for 1 week)"
            required
          />
        </div>
      )}

      {step === 3 && (
        <div className="form-step">
          <h2>Group Settings</h2>
          <Input
            label="Maximum Members"
            type="number"
            value={formData.maxMembers}
            onChange={e => updateField('maxMembers', e.target.value)}
            error={errors.maxMembers}
            helperText="Maximum number of members allowed"
            required
          />
          <Input
            label="Minimum Members"
            type="number"
            value={formData.minMembers}
            onChange={e => updateField('minMembers', e.target.value)}
            error={errors.minMembers}
            helperText="Minimum members needed to start"
            required
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
            <div className="review-item">
              <span className="review-label">Contribution:</span>
              <span>{formData.contributionAmount} XLM</span>
            </div>
            <div className="review-item">
              <span className="review-label">Cycle Duration:</span>
              <span>{formData.cycleDuration}s</span>
            </div>
            <div className="review-item">
              <span className="review-label">Members:</span>
              <span>{formData.minMembers} - {formData.maxMembers}</span>
            </div>
          </div>
        </div>
      )}

      <div className="form-actions">
        {step > 1 && (
          <Button variant="secondary" onClick={handleBack}>
            Back
          </Button>
        )}
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {step < 4 ? (
          <Button onClick={handleNext}>Next</Button>
        ) : (
          <Button onClick={handleSubmit}>Create Group</Button>
        )}
      </div>
    </div>
  );
}

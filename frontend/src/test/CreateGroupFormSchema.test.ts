import { describe, it, expect } from 'vitest';
import {
  validateFormStep,
  validateAndTransformFormData,
  VALIDATION_CONSTANTS,
} from '../components/CreateGroupForm/schema';

describe('CreateGroupForm schema & validation (pure functions, no React)', () => {
  it('validates Step 0 (Basics)', () => {
    // Empty name should fail
    const errorsEmpty = validateFormStep(0, {
      name: '',
      description: 'Test description',
      imageUrl: '',
      contributionAmount: '',
      cycleDuration: '',
      maxMembers: '',
      minMembers: '2',
      insuranceEnabled: false,
      insurancePremiumRate: '5',
    });
    expect(errorsEmpty.name).toBeDefined();

    // Valid basics step
    const errorsValid = validateFormStep(0, {
      name: 'Valid Savings Group',
      description: 'A valid description for testing',
      imageUrl: '',
      contributionAmount: '',
      cycleDuration: '',
      maxMembers: '',
      minMembers: '2',
      insuranceEnabled: false,
      insurancePremiumRate: '5',
    });
    expect(Object.keys(errorsValid).length).toBe(0);
  });

  it('validates Step 1 (Finances)', () => {
    const errorsInvalid = validateFormStep(1, {
      name: 'Valid Name',
      description: 'Valid Desc',
      imageUrl: '',
      contributionAmount: '-5',
      cycleDuration: '',
      maxMembers: '',
      minMembers: '2',
      insuranceEnabled: false,
      insurancePremiumRate: '5',
    });
    expect(errorsInvalid.contributionAmount).toBeDefined();
    expect(errorsInvalid.cycleDuration).toBeDefined();
  });

  it('transforms valid form data into CreateGroupInput', () => {
    const rawData = {
      name: 'Solar Circle',
      description: 'Community savings circle',
      imageUrl: 'https://example.com/logo.png',
      contributionAmount: '100',
      cycleDuration: '604800',
      maxMembers: '10',
      minMembers: '2',
      insuranceEnabled: true,
      insurancePremiumRate: '5',
    };

    const transformed = validateAndTransformFormData(rawData);
    expect(transformed.name).toBe('Solar Circle');
    expect(transformed.contributionAmount).toBe(100);
    expect(transformed.cycleDuration).toBe(604800);
    expect(transformed.maxMembers).toBe(10);
    expect(transformed.insuranceEnabled).toBe(true);
  });
});

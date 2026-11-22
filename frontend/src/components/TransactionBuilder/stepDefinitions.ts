import type { ReactNode } from "react";

export type TransactionStepId =
  | "recipients"
  | "amount"
  | "asset"
  | "memo"
  | "review";

export type TransactionStepValues = {
  recipients?: string[];
  amount?: string;
  asset?: string;
  memo?: string;
};

export type StepValidationResult = {
  valid: boolean;
  error?: string;
};

export type StepRendererKey =
  | "recipients"
  | "amount"
  | "asset"
  | "memo"
  | "review";

export type StepRendererProps = {
  values: TransactionStepValues;
  onChange: (patch: Partial<TransactionStepValues>) => void;
};

export type StepDefinition = {
  id: TransactionStepId;
  label: string;
  validator: (values: TransactionStepValues) => StepValidationResult;
  renderer: StepRendererKey;
};

const validateRecipients = (
  values: TransactionStepValues,
): StepValidationResult => {
  const recipients = values.recipients ?? [];
  if (recipients.length === 0) {
    return { valid: false, error: "At least one recipient is required" };
  }
  if (recipients.some((recipient) => recipient.trim().length === 0)) {
    return { valid: false, error: "Recipients cannot be empty" };
  }
  return { valid: true };
};

const validateAmount = (values: TransactionStepValues): StepValidationResult => {
  const amount = values.amount?.trim() ?? "";
  if (amount.length === 0) {
    return { valid: false, error: "Amount is required" };
  }
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { valid: false, error: "Amount must be a positive number" };
  }
  return { valid: true };
};

const validateAsset = (values: TransactionStepValues): StepValidationResult => {
  const asset = values.asset?.trim() ?? "";
  if (asset.length === 0) {
    return { valid: false, error: "Asset is required" };
  }
  return { valid: true };
};

const validateMemo = (values: TransactionStepValues): StepValidationResult => {
  const memo = values.memo ?? "";
  if (memo.length > 28) {
    return { valid: false, error: "Memo must be 28 characters or fewer" };
  }
  return { valid: true };
};

const validateReview = (values: TransactionStepValues): StepValidationResult => {
  const checks = [
    validateRecipients(values),
    validateAmount(values),
    validateAsset(values),
    validateMemo(values),
  ];
  const failed = checks.find((check) => !check.valid);
  return failed ?? { valid: true };
};

export const STEP_DEFINITIONS: StepDefinition[] = [
  {
    id: "recipients",
    label: "Recipients",
    validator: validateRecipients,
    renderer: "recipients",
  },
  {
    id: "amount",
    label: "Amount",
    validator: validateAmount,
    renderer: "amount",
  },
  {
    id: "asset",
    label: "Asset",
    validator: validateAsset,
    renderer: "asset",
  },
  {
    id: "memo",
    label: "Memo",
    validator: validateMemo,
    renderer: "memo",
  },
  {
    id: "review",
    label: "Review",
    validator: validateReview,
    renderer: "review",
  },
];

export const STEP_DEFINITIONS_BY_ID: Record<TransactionStepId, StepDefinition> =
  STEP_DEFINITIONS.reduce(
    (acc, definition) => {
      acc[definition.id] = definition;
      return acc;
    },
    {} as Record<TransactionStepId, StepDefinition>,
  );

export const getStepDefinition = (id: TransactionStepId): StepDefinition =>
  STEP_DEFINITIONS_BY_ID[id];

export const validateStep = (
  id: TransactionStepId,
  values: TransactionStepValues,
): StepValidationResult => getStepDefinition(id).validator(values);

export type StepRenderer = (props: StepRendererProps) => ReactNode;

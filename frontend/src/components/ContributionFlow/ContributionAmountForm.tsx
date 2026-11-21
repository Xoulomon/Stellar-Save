import { Box, Stack, TextField, Chip, CircularProgress } from '@mui/material';

import { Button } from '../Button';
import { translateValidationMessage } from '../../schemas/contributionSchema';

import type { FormEvent } from 'react';
import type { ValidationMessage } from '../../schemas/contributionSchema';

interface Props {
  amountInput: string;
  defaultAmount?: number;
  minAmount: number;
  maxAmount: number;
  fieldError: ValidationMessage | null;
  isProcessing: boolean;
  canContribute: boolean;
  onAmountChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ContributionAmountForm({
  amountInput,
  defaultAmount,
  minAmount,
  maxAmount,
  fieldError,
  isProcessing,
  canContribute,
  onAmountChange,
  onSubmit,
}: Props) {
  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Stack spacing={2}>
        <TextField
          label="Contribution Amount (XLM)"
          type="number"
          value={amountInput}
          onChange={(event) => onAmountChange(event.target.value)}
          error={!!fieldError}
          helperText={
            fieldError
              ? translateValidationMessage(fieldError)
              : `Min: ${minAmount} XLM · Max: ${maxAmount.toLocaleString()} XLM`
          }
          inputProps={{ min: minAmount, max: maxAmount, step: '0.01' }}
          disabled={isProcessing || !canContribute}
          fullWidth
          size="small"
        />
        {defaultAmount && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[defaultAmount * 0.5, defaultAmount, defaultAmount * 2].map((value) => (
              <Chip
                key={value}
                label={`${value} XLM`}
                size="small"
                variant={Number(amountInput) === value ? 'filled' : 'outlined'}
                color={Number(amountInput) === value ? 'primary' : 'default'}
                onClick={() => onAmountChange(String(value))}
                disabled={isProcessing || !canContribute}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}
        <Button type="submit" variant="primary" disabled={isProcessing || !canContribute}>
          {isProcessing ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} color="inherit" />
              Processing...
            </Box>
          ) : 'Contribute'}
        </Button>
      </Stack>
    </Box>
  );
}

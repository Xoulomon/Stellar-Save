import {
  Box,
  Card,
  CardContent,
  IconButton,
  Stack,
  Typography,
  Chip,
  Collapse,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { useState } from 'react';

import { STEP_TYPE_META } from '../../types/transactionBuilder';
import { STEP_DEFINITION_LIST, getStepDefinition } from './stepDefinitions';

import type { TransactionBuilderStep, StepOperationType } from '../../types/transactionBuilder';
import type { StepRendererKey } from './stepDefinitions';

interface TransactionStepCardProps {
  step: TransactionBuilderStep;
  index: number;
  total: number;
  onChange: (step: TransactionBuilderStep) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function TransactionStepCard({
  step,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TransactionStepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = STEP_TYPE_META[step.type];
  const definition = getStepDefinition(step.type);

  const updateParam = (key: string, value: string) => {
    onChange({ ...step, params: { ...step.params, [key]: value } });
  };

  const handleTypeChange = (newType: StepOperationType) => {
    onChange({ ...step, type: newType, params: {} });
  };

  return (
    <Card
      variant="outlined"
      sx={{
        opacity: step.enabled ? 1 : 0.5,
        borderLeft: `4px solid ${meta?.color || '#666'}`,
        mb: 1,
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: meta?.color || '#666',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {index + 1}
            </Typography>

            <TextField
              select
              size="small"
              value={step.type}
              onChange={(e) => handleTypeChange(e.target.value as StepOperationType)}
              sx={{ minWidth: 160, '& .MuiInputBase-root': { fontSize: '0.875rem' } }}
            >
              {STEP_DEFINITION_LIST.map((def) => (
                <MenuItem key={def.id} value={def.id}>
                  {STEP_TYPE_META[def.id]?.icon} {def.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              placeholder="Step label"
              value={step.label}
              onChange={(e) => onChange({ ...step, label: e.target.value })}
              sx={{ flexGrow: 1, '& .MuiInputBase-root': { fontSize: '0.875rem' } }}
            />

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={step.enabled}
                  onChange={(e) => onChange({ ...step, enabled: e.target.checked })}
                />
              }
              label=""
              sx={{ m: 0 }}
            />

            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Collapse step details' : 'Expand step details'}
            >
              <span
                style={{ transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block' }}
              >
                ▼
              </span>
            </IconButton>

            <IconButton size="small" onClick={onDelete} color="error" aria-label="Delete step">
              ✕
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={onMoveUp}
              disabled={index === 0}
              aria-label="Move step up"
            >
              ▲
            </IconButton>
            <IconButton
              size="small"
              onClick={onMoveDown}
              disabled={index === total - 1}
              aria-label="Move step down"
            >
              ▼
            </IconButton>
            {meta && (
              <Chip
                label={meta.description}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Box>

          <Collapse in={expanded}>
            <StepParamsEditor
              rendererKey={definition.rendererKey}
              step={step}
              updateParam={updateParam}
            />
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
}

interface StepParamsEditorProps {
  rendererKey: StepRendererKey;
  step: TransactionBuilderStep;
  updateParam: (key: string, value: string) => void;
}

const STEP_RENDERERS: Record<StepRendererKey, (props: StepParamsEditorProps) => JSX.Element> = {
  payment: ({ step, updateParam }) => {
    const p = step.params as Record<string, string>;
    return (
      <Stack spacing={1.5} sx={{ pt: 1 }}>
        <TextField
          size="small"
          label="Destination Address"
          placeholder="G..."
          value={p.destination || ''}
          onChange={(e) => updateParam('destination', e.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Amount (XLM)"
          placeholder="0.0"
          value={p.amount || ''}
          onChange={(e) => updateParam('amount', e.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Memo (optional)"
          placeholder="memo"
          value={p.memo || ''}
          onChange={(e) => updateParam('memo', e.target.value)}
          fullWidth
        />
      </Stack>
    );
  },
  manage_data: ({ step, updateParam }) => {
    const p = step.params as Record<string, string>;
    return (
      <Stack spacing={1.5} sx={{ pt: 1 }}>
        <TextField
          size="small"
          label="Data Key"
          placeholder="key_name"
          value={p.key || ''}
          onChange={(e) => updateParam('key', e.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Data Value"
          placeholder="value"
          value={p.value || ''}
          onChange={(e) => updateParam('value', e.target.value)}
          fullWidth
        />
      </Stack>
    );
  },
  manage_sell_offer: ({ step, updateParam }) => {
    const p = step.params as Record<string, string>;
    return (
      <Stack spacing={1.5} sx={{ pt: 1 }}>
        <TextField
          size="small"
          label="Selling Asset"
          placeholder="XLM"
          value={p.selling || ''}
          onChange={(e) => updateParam('selling', e.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Buying Asset"
          placeholder="XLM"
          value={p.buying || ''}
          onChange={(e) => updateParam('buying', e.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Amount"
          placeholder="0.0"
          value={p.amount || ''}
          onChange={(e) => updateParam('amount', e.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Price"
          placeholder="1.0"
          value={p.price || ''}
          onChange={(e) => updateParam('price', e.target.value)}
          fullWidth
        />
      </Stack>
    );
  },
  contract_call: ({ step, updateParam }) => {
    const p = step.params as Record<string, string>;
    return (
      <Stack spacing={1.5} sx={{ pt: 1 }}>
        <TextField
          size="small"
          label="Contract ID"
          placeholder="C..."
          value={p.contractId || ''}
          onChange={(e) => updateParam('contractId', e.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Method Name"
          placeholder="method_name"
          value={p.method || ''}
          onChange={(e) => updateParam('method', e.target.value)}
          fullWidth
        />
      </Stack>
    );
  },
};

function StepParamsEditor(props: StepParamsEditorProps) {
  const Renderer = STEP_RENDERERS[props.rendererKey];
  return <Renderer {...props} />;
}

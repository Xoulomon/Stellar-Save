import { useState, useCallback } from 'react';
import {
  Box,
  Stack,
  Typography,
  Menu,
  MenuItem,
  Alert,
  Snackbar,
} from '@mui/material';
import { Button } from '../Button';
import { TransactionStepCard } from './TransactionStepCard';
import { SimulationPanel } from './SimulationPanel';
import { SaveTemplateModal } from './SaveTemplateModal';
import type {
  TransactionBuilderStep,
  StepOperationType,
  SimulationResult,
  TransactionTemplate,
} from '../../types/transactionBuilder';
import {
  createStep,
  simulateTransaction,
  loadTemplates,
} from '../../services/transactionBuilderService';

interface TransactionBuilderProps {
  initialSteps?: TransactionBuilderStep[];
  walletAddress?: string;
}

export function TransactionBuilder({ initialSteps, walletAddress }: TransactionBuilderProps) {
  const [steps, setSteps] = useState<TransactionBuilderStep[]>(initialSteps || []);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadMenuAnchor, setLoadMenuAnchor] = useState<null | HTMLElement>(null);
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const handleStepChange = useCallback((index: number, updated: TransactionBuilderStep) => {
    setSteps(prev => prev.map((s, i) => (i === index ? updated : s)));
    setSimResult(null);
  }, []);

  const handleDeleteStep = useCallback((index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
    setSimResult(null);
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setSteps(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setSimResult(null);
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setSteps(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setSimResult(null);
  }, []);

  const handleAddStep = useCallback((type: StepOperationType) => {
    setSteps(prev => [...prev, createStep(type, prev.length)]);
    setAddMenuAnchor(null);
    setSimResult(null);
  }, []);

  const handleSimulate = useCallback(async () => {
    const enabled = steps.filter(s => s.enabled);
    if (enabled.length === 0) {
      setSnackbar({ message: 'Add at least one enabled operation to simulate', severity: 'error' });
      return;
    }

    setSimLoading(true);
    setSimResult(null);
    try {
      const result = await simulateTransaction(steps, walletAddress);
      setSimResult(result);
    } catch (err) {
      setSnackbar({ message: err instanceof Error ? err.message : 'Simulation failed', severity: 'error' });
    } finally {
      setSimLoading(false);
    }
  }, [steps, walletAddress]);

  const handleLoadTemplates = useCallback(() => {
    const loaded = loadTemplates();
    setTemplates(loaded);
    setLoadMenuAnchor(null);
  }, []);

  const handleApplyTemplate = useCallback((template: TransactionTemplate) => {
    setSteps(template.steps.map(s => ({ ...s })));
    setSimResult(null);
    setSnackbar({ message: `Loaded template: ${template.name}`, severity: 'success' });
  }, []);

  const hasEnabled = steps.some(s => s.enabled);

  return (
    <Box>
      <Stack spacing={2}>
        {/* Toolbar */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="primary" size="sm" onClick={(e) => setAddMenuAnchor(e.currentTarget)}>
            + Add Operation
          </Button>

          <Button variant="secondary" size="sm" onClick={(e) => {
            handleLoadTemplates();
            setLoadMenuAnchor(e.currentTarget);
          }}>
            Load Template
          </Button>

          {steps.length > 0 && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSimulate}
                disabled={simLoading || !hasEnabled}
              >
                {simLoading ? 'Simulating...' : 'Run Simulation'}
              </Button>

              <Button variant="secondary" size="sm" onClick={() => setSaveModalOpen(true)}>
                Save Template
              </Button>
            </>
          )}

          {steps.length > 0 && (
            <Button variant="danger" size="sm" onClick={() => { setSteps([]); setSimResult(null); }}>
              Clear All
            </Button>
          )}
        </Box>

        {/* Add Step Menu */}
        <Menu anchorEl={addMenuAnchor} open={Boolean(addMenuAnchor)} onClose={() => setAddMenuAnchor(null)}>
          <MenuItem disabled><Typography variant="caption" color="text.secondary">Standard Operations</Typography></MenuItem>
          <MenuItem onClick={() => handleAddStep('payment')}>Payment</MenuItem>
          <MenuItem onClick={() => handleAddStep('manage_data')}>Manage Data</MenuItem>
          <MenuItem onClick={() => handleAddStep('manage_sell_offer')}>Sell Offer</MenuItem>
          <MenuItem disabled><Typography variant="caption" color="text.secondary">Contract Operations</Typography></MenuItem>
          <MenuItem onClick={() => handleAddStep('contract_call')}>Contract Call</MenuItem>
          <MenuItem onClick={() => handleAddStep('create_group')}>Create Group</MenuItem>
          <MenuItem onClick={() => handleAddStep('join_group')}>Join Group</MenuItem>
          <MenuItem onClick={() => handleAddStep('contribute')}>Contribute</MenuItem>
          <MenuItem onClick={() => handleAddStep('execute_payout')}>Execute Payout</MenuItem>
        </Menu>

        {/* Load Template Menu */}
        <Menu anchorEl={loadMenuAnchor} open={Boolean(loadMenuAnchor)} onClose={() => setLoadMenuAnchor(null)}>
          {templates.length === 0 && (
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">No saved templates</Typography>
            </MenuItem>
          )}
          {templates.map(tpl => (
            <MenuItem key={tpl.id} onClick={() => handleApplyTemplate(tpl)}>
              <Stack>
                <Typography variant="body2" fontWeight={600}>{tpl.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {tpl.steps.filter(s => s.enabled).length} ops · {new Date(tpl.updatedAt).toLocaleDateString()}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </Menu>

        {/* Steps List */}
        {steps.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <Typography variant="body1" gutterBottom>
              No operations yet
            </Typography>
            <Typography variant="body2">
              Click "Add Operation" to start building your transaction chain.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={0.5}>
            {steps.map((step, i) => (
              <TransactionStepCard
                key={step.id}
                step={step}
                index={i}
                total={steps.length}
                onChange={(updated) => handleStepChange(i, updated)}
                onDelete={() => handleDeleteStep(i)}
                onMoveUp={() => handleMoveUp(i)}
                onMoveDown={() => handleMoveDown(i)}
              />
            ))}
          </Stack>
        )}

        {/* Simulation Results */}
        {steps.length > 0 && (
          <SimulationPanel
            result={simResult}
            loading={simLoading}
            onRetry={handleSimulate}
          />
        )}
      </Stack>

      {/* Save Template Modal */}
      <SaveTemplateModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        steps={steps}
      />

      {/* Snackbar */}
      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)} sx={{ fontSize: '0.85rem' }}>
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

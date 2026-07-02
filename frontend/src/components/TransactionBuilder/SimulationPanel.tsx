import { Box, Stack, Typography, Chip, Alert, CircularProgress, Divider } from '@mui/material';
import type { SimulationResult } from '../../types/transactionBuilder';

interface SimulationPanelProps {
  result: SimulationResult | null;
  loading: boolean;
  onRetry: () => void;
}

export function SimulationPanel({ result, loading, onRetry }: SimulationPanelProps) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={40} />
          <Typography variant="body2" color="text.secondary">Simulating transaction...</Typography>
        </Stack>
      </Box>
    );
  }

  if (!result) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Add operations and run simulation to preview fees and outcomes.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" fontWeight={700}>Simulation Results</Typography>

      {result.error && (
        <Alert severity="error" sx={{ fontSize: '0.8rem' }}>
          {result.error}
        </Alert>
      )}

      {result.success && !result.error && (
        <Alert severity="success" sx={{ fontSize: '0.8rem' }}>
          Simulation completed successfully
        </Alert>
      )}

      <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">Status</Typography>
            <Chip
              label={result.success ? 'Success' : 'Failed'}
              color={result.success ? 'success' : 'error'}
              size="small"
            />
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Estimated Fee</Typography>
            <Typography variant="body2" fontWeight={600} color={result.feeInXlm > 0.1 ? 'warning.main' : undefined}>
              {result.feeEstimate}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Operations</Typography>
            <Typography variant="body2" fontWeight={600}>{result.operationsCount}</Typography>
          </Box>

          {result.footprintBytes > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Footprint</Typography>
              <Typography variant="body2" fontWeight={600}>
                {result.footprintBytes > 1024
                  ? `${(result.footprintBytes / 1024).toFixed(1)} KB`
                  : `${result.footprintBytes} B`}
              </Typography>
            </Box>
          )}

          {result.result && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Result</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {result.result}
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      {result.warnings.length > 0 && (
        <Stack spacing={0.5}>
          {result.warnings.map((w, i) => (
            <Alert key={i} severity="warning" sx={{ fontSize: '0.75rem', py: 0.5 }}>
              {w}
            </Alert>
          ))}
        </Stack>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Chip
          label="Re-run Simulation"
          size="small"
          clickable
          variant="outlined"
          onClick={onRetry}
          icon={<span>↻</span>}
        />
      </Box>
    </Stack>
  );
}

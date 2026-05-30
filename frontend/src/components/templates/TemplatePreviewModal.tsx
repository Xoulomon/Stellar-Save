import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Typography } from '@mui/material';
import type { GroupTemplate } from '../../types/template';

interface TemplatePreviewModalProps {
  template: GroupTemplate | null;
  onClose: () => void;
  onUse: (template: GroupTemplate) => void;
}

export function TemplatePreviewModal({ template, onClose, onUse }: TemplatePreviewModalProps) {
  if (!template) return null;

  const rows: [string, string][] = [
    ['Cycle duration', `${template.cycleDuration} days`],
    ['Max members', String(template.maxMembers)],
    ['Total duration', template.totalDuration],
    ['Category', template.category],
  ];

  return (
    <Dialog open={!!template} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{template.name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {template.description}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {rows.map(([label, value]) => (
            <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="body2" fontWeight="medium" sx={{ textTransform: 'capitalize' }}>{value}</Typography>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={() => { onUse(template); onClose(); }}>
          Use Template
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import { Box, Button, Chip, Typography } from '@mui/material';
import type { GroupTemplate } from '../../types/template';

interface TemplateCardProps {
  template: GroupTemplate;
  onUse: (template: GroupTemplate) => void;
  onPreview: (template: GroupTemplate) => void;
}

const categoryColor: Record<GroupTemplate['category'], 'success' | 'warning' | 'error'> = {
  short: 'success',
  medium: 'warning',
  long: 'error',
};

export function TemplateCard({ template, onUse, onPreview }: TemplateCardProps) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        bgcolor: 'background.paper',
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Typography variant="subtitle1" fontWeight="bold">
          {template.name}
        </Typography>
        <Chip
          label={template.category}
          color={categoryColor[template.category]}
          size="small"
          sx={{ textTransform: 'capitalize' }}
        />
      </Box>

      <Typography variant="body2" color="text.secondary">
        {template.description}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <Stat label="Cycle" value={`${template.cycleDuration}d`} />
        <Stat label="Members" value={`up to ${template.maxMembers}`} />
        <Stat label="Duration" value={template.totalDuration} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mt: 'auto', pt: 0.5 }}>
        <Button size="small" variant="outlined" onClick={() => onPreview(template)} sx={{ flex: 1 }}>
          Preview
        </Button>
        <Button size="small" variant="contained" onClick={() => onUse(template)} sx={{ flex: 1 }}>
          Use Template
        </Button>
      </Box>
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight="medium">
        {value}
      </Typography>
    </Box>
  );
}

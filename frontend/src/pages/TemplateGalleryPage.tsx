import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { AppLayout } from '../ui';
import { TemplateCard } from '../components/templates/TemplateCard';
import { TemplatePreviewModal } from '../components/templates/TemplatePreviewModal';
import { GROUP_TEMPLATES } from '../types/template';
import type { GroupTemplate } from '../types/template';
import { ROUTES } from '../routing/constants';

type CategoryFilter = 'all' | GroupTemplate['category'];

export default function TemplateGalleryPage() {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<GroupTemplate | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const filtered = filter === 'all'
    ? GROUP_TEMPLATES
    : GROUP_TEMPLATES.filter((t) => t.category === filter);

  const handleUse = (template: GroupTemplate) => {
    navigate(ROUTES.GROUP_CREATE, { state: { templateId: template.id } });
  };

  return (
    <AppLayout
      title="Group Templates"
      subtitle="Pick a template to quickly start a savings group"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, v) => v && setFilter(v)}
          size="small"
          aria-label="Filter templates by duration"
        >
          {(['all', 'short', 'medium', 'long'] as const).map((cat) => (
            <ToggleButton key={cat} value={cat} sx={{ textTransform: 'capitalize' }}>
              {cat}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {filtered.length === 0 ? (
          <Typography color="text.secondary">No templates match this filter.</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {filtered.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onUse={handleUse}
                onPreview={setPreview}
              />
            ))}
          </Box>
        )}
      </Box>

      <TemplatePreviewModal
        template={preview}
        onClose={() => setPreview(null)}
        onUse={handleUse}
      />
    </AppLayout>
  );
}

import { Stack, Typography, Box, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircleIcon';
import EmojiEventsIcon from '@mui/icons-material/EmojiEventsIcon';
import type { PayoutEntry } from '../../types/contribution';

/**
 * Payout rotation timeline with past and future recipients.
 */
export function PayoutRotationTimeline({ entries }: { entries: PayoutEntry[] }) {
  return (
    <Stack spacing={1.5}>
      {entries.map((entry) => {
        const isCompleted = entry.status === 'completed';
        const isNext = entry.status === 'next';
        return (
          <Box
            key={entry.position}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isNext ? 'primary.main' : isCompleted ? 'success.light' : 'divider',
              bgcolor: isNext ? 'primary.50' : isCompleted ? 'success.50' : 'background.paper',
              opacity: isCompleted ? 0.75 : 1,
            }}
          >
            {/* Position badge */}
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: isNext ? 'primary.main' : isCompleted ? 'success.main' : 'action.hover',
                color: isNext || isCompleted ? 'white' : 'text.secondary',
                fontWeight: 700,
                fontSize: '0.85rem',
                flexShrink: 0,
              }}
            >
              {isCompleted ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : entry.position}
            </Box>

            {/* Member info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {entry.memberName}
                </Typography>
                {isNext && (
                  <Chip label="Next Payout" size="small" color="primary" icon={<EmojiEventsIcon />} sx={{ height: 20, fontSize: '0.65rem' }} />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {isCompleted && entry.paidAt
                  ? `Paid on ${entry.paidAt.toLocaleDateString()}`
                  : `Est. ${entry.estimatedDate.toLocaleDateString()}`}
              </Typography>
            </Box>

            {/* Amount */}
            <Typography variant="body2" fontWeight={700} color={isNext ? 'primary.main' : 'text.primary'}>
              {entry.amount} XLM
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

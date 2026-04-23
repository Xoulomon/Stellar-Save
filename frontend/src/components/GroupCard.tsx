import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Button,
  Chip,
  Stack,
  Avatar,
  Divider,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import { PublicGroup } from '../types/group';

interface GroupCardProps {
  group: PublicGroup;
  onPreview: (group: PublicGroup) => void;
  onJoin: (group: PublicGroup) => void;
}

export const GroupCard: React.FC<GroupCardProps> = ({ group, onPreview, onJoin }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'starting_soon': return 'primary';
      case 'completed': return 'default';
      default: return 'default';
    }
  };

  return (
    <Card 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        borderRadius: 4,
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
        border: '1px solid',
        borderColor: 'divider',
      }}
      onClick={() => onPreview(group)}
    >
      <CardContent sx={{ flexGrow: 1, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Chip 
            label={group.status.replace('_', ' ').toLowerCase()} 
            color={getStatusColor(group.status) as any} 
            size="small"
            variant="soft"
            sx={{ fontWeight: 'bold', borderRadius: 1.5 }}
          />
          <Typography variant="caption" color="text.secondary">
            {group.duration}
          </Typography>
        </Box>

        <Typography variant="h6" fontWeight="bold" gutterBottom noWrap>
          {group.name}
        </Typography>

        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ 
            mb: 3, 
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '2.5rem'
          }}
        >
          {group.description || 'No description available for this savings group.'}
        </Typography>

        <Divider sx={{ my: 2, borderStyle: 'dashed' }} />

        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              CONTRIBUTION
            </Typography>
            <Typography variant="subtitle1" fontWeight="bold">
              {group.contributionAmount} {group.currency}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary" display="block">
              MEMBERS
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
              <GroupsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="subtitle1" fontWeight="bold">
                {group.memberCount}
              </Typography>
            </Box>
          </Box>
        </Stack>
      </CardContent>

      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button 
          fullWidth 
          variant="contained" 
          disableElevation
          onClick={(e) => {
            e.stopPropagation();
            onJoin(group);
          }}
          disabled={group.status === 'completed'}
          sx={{ 
            borderRadius: 2, 
            textTransform: 'none', 
            fontWeight: 'bold',
          }}
        >
          {group.status === 'completed' ? 'Closed' : 'Join Group'}
        </Button>
      </CardActions>
    </Card>
  );
};

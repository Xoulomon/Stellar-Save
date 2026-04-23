import React from 'react';
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Slider,
  Button,
  Divider,
  Paper,
  IconButton,
  useMediaQuery,
  Theme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { GroupFilters } from '../types/group';

interface FilterSidebarProps {
  filters: GroupFilters;
  onFilterChange: (patch: Partial<GroupFilters>) => void;
  onClear: () => void;
  onClose?: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filters,
  onFilterChange,
  onClear,
  onClose,
}) => {
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));

  const handleStatusChange = (status: string) => {
    onFilterChange({ status: status as any });
  };

  const handleDurationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ duration: event.target.value as any });
  };

  const handleAmountChange = (_event: Event, value: number | number[]) => {
    const [min, max] = value as number[];
    onFilterChange({ minAmount: min.toString(), maxAmount: max.toString() });
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        borderRight: isMobile ? 'none' : '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight="bold">
          Filters
        </Typography>
        {isMobile && onClose && (
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      <Divider />

      {/* Status Filter */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom fontWeight="bold">
          STATUS
        </Typography>
        <RadioGroup
          value={filters.status}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <FormControlLabel value="all" control={<Radio size="small" />} label="All Groups" />
          <FormControlLabel value="active" control={<Radio size="small" />} label="Active" />
          <FormControlLabel value="starting_soon" control={<Radio size="small" />} label="Starting Soon" />
          <FormControlLabel value="completed" control={<Radio size="small" />} label="Completed" />
        </RadioGroup>
      </Box>

      {/* Duration Filter */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom fontWeight="bold">
          DURATION
        </Typography>
        <RadioGroup value={filters.duration} onChange={handleDurationChange}>
          <FormControlLabel value="all" control={<Radio size="small" />} label="All" />
          <FormControlLabel value="short-term" control={<Radio size="small" />} label="Short-term" />
          <FormControlLabel value="long-term" control={<Radio size="small" />} label="Long-term" />
        </RadioGroup>
      </Box>

      {/* Amount Range Filter */}
      <Box sx={{ px: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom fontWeight="bold">
          CONTRIBUTION AMOUNT (XLM)
        </Typography>
        <Box sx={{ mt: 4 }}>
          <Slider
            value={[Number(filters.minAmount) || 0, Number(filters.maxAmount) || 1000]}
            onChange={handleAmountChange}
            valueLabelDisplay="on"
            min={0}
            max={1000}
            step={10}
            sx={{
              '& .MuiSlider-valueLabel': {
                fontSize: '0.75rem',
                top: -6,
              },
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption">0</Typography>
          <Typography variant="caption">1000+</Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={onClear}
          sx={{ borderRadius: 2 }}
        >
          Clear All
        </Button>
      </Box>
    </Paper>
  );
};

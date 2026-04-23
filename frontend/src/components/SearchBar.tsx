import React, { useState, useEffect } from 'react';
import {
  TextField,
  InputAdornment,
  Box,
  CircularProgress,
  IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  loading?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = "Search groups...",
  loading = false,
}) => {
  const [query, setQuery] = useState('');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 400);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <Box sx={{ width: '100%' }}>
      <TextField
        fullWidth
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        variant="outlined"
        size="medium"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {loading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : query ? (
                  <IconButton onClick={handleClear} size="small">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </InputAdornment>
            ),
            sx: {
              borderRadius: 3,
              bgcolor: 'background.paper',
              '&:hover': {
                bgcolor: 'action.hover',
              }
            }
          }
        }}
      />
    </Box>
  );
};
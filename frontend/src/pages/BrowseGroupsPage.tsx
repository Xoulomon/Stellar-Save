import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Stack,
  Button,
  useMediaQuery,
  Theme,
  Drawer,
  Pagination,
  Alert,
  Skeleton,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';

import { useGroups } from '../hooks/useGroups';
import { SearchBar } from '../components/SearchBar';
import { GroupCard } from '../components/GroupCard';
import { FilterSidebar } from '../components/FilterSidebar';
import { GroupPreview } from '../components/GroupPreview';
import { JoinGroupModal } from '../components/JoinGroupModal';
import { PublicGroup } from '../types/group';

const BrowseGroupsPage: React.FC = () => {
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [selectedGroupForPreview, setSelectedGroupForPreview] = useState<PublicGroup | null>(null);
  const [selectedGroupForJoin, setSelectedGroupForJoin] = useState<PublicGroup | null>(null);

  const {
    groups,
    pagination,
    filters,
    isLoading,
    error,
    setFilters,
    clearFilters,
    setPage,
    refresh,
  } = useGroups({ initialPageSize: 10 });

  const handlePreview = (group: PublicGroup) => {
    setSelectedGroupForPreview(group);
  };

  const handleJoinInit = (group: PublicGroup) => {
    setSelectedGroupForJoin(group);
  };

  const handleJoinConfirmed = () => {
    // Optionally refresh or show toast
    refresh();
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4, minHeight: '100vh' }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" fontWeight="900" gutterBottom color="primary">
          Browse Groups
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Find a community saving pool that matches your financial goals.
        </Typography>
      </Box>

      {/* Search and Mobile Filter Toggle */}
      <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
        <SearchBar 
          onSearch={(q) => setFilters({ search: q })} 
          loading={isLoading}
        />
        {isMobile && (
          <Button
            variant="outlined"
            startIcon={<TuneIcon />}
            onClick={() => setIsFilterDrawerOpen(true)}
            sx={{ borderRadius: 3, px: 3 }}
          >
            Filters
          </Button>
        )}
      </Stack>

      <Grid container spacing={4}>
        {/* Sidebar - Desktop */}
        {!isMobile && (
          <Grid item lg={3} md={4}>
            <FilterSidebar
              filters={filters}
              onFilterChange={setFilters}
              onClear={clearFilters}
            />
          </Grid>
        )}

        {/* Main Content */}
        <Grid item lg={9} md={8} xs={12}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} action={<Button color="inherit" size="small" onClick={refresh}>Retry</Button>}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {isLoading ? (
              // Loading skeletons
              Array.from(new Array(6)).map((_, index) => (
                <Grid item lg={4} sm={6} xs={12} key={index}>
                  <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 4 }} />
                </Grid>
              ))
            ) : groups.length > 0 ? (
              groups.map((group) => (
                <Grid item lg={4} sm={6} xs={12} key={group.id}>
                  <GroupCard
                    group={group}
                    onPreview={handlePreview}
                    onJoin={handleJoinInit}
                  />
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <Box sx={{ textAlign: 'center', py: 10, bgcolor: 'background.paper', borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
                  <Typography variant="h6" gutterBottom>No groups found</Typography>
                  <Typography color="text.secondary" sx={{ mb: 3 }}>Try adjusting your filters or search terms.</Typography>
                  <Button variant="contained" onClick={clearFilters} sx={{ borderRadius: 2 }}>Clear All Filters</Button>
                </Box>
              </Grid>
            )}
          </Grid>

          {/* Pagination */}
          {!isLoading && pagination.totalPages > 1 && (
            <Box sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}>
              <Pagination
                count={pagination.totalPages}
                page={pagination.page}
                onChange={(_, page) => setPage(page)}
                color="primary"
                size={isMobile ? 'medium' : 'large'}
                sx={{
                  '& .MuiPaginationItem-root': {
                    borderRadius: 2,
                    fontWeight: 'bold',
                  },
                }}
              />
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Mobile Filter Drawer */}
      <Drawer
        anchor="bottom"
        open={isFilterDrawerOpen && isMobile}
        onClose={() => setIsFilterDrawerOpen(false)}
        PaperProps={{
          sx: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80vh' }
        }}
      >
        <FilterSidebar
          filters={filters}
          onFilterChange={setFilters}
          onClear={clearFilters}
          onClose={() => setIsFilterDrawerOpen(false)}
        />
      </Drawer>

      {/* Preview Side Drawer */}
      <GroupPreview
        group={selectedGroupForPreview}
        open={Boolean(selectedGroupForPreview)}
        onClose={() => setSelectedGroupForPreview(null)}
        onJoin={(group) => {
          setSelectedGroupForPreview(null);
          handleJoinInit(group);
        }}
      />

      {/* Join Confirmation Modal */}
      <JoinGroupModal
        group={selectedGroupForJoin}
        open={Boolean(selectedGroupForJoin)}
        onClose={() => setSelectedGroupForJoin(null)}
        onJoined={handleJoinConfirmed}
      />
    </Container>
  );
};

export default BrowseGroupsPage;

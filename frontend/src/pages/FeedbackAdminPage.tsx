import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Select, MenuItem,
  FormControl, InputLabel, Button, TextField, Skeleton, Divider,
} from '@mui/material';
import { AppLayout } from '../ui';

interface FeedbackItem {
  id: string;
  category: string;
  message: string;
  votes: number;
  status: string;
  page?: string;
  response?: string;
  createdAt: string;
}

const STATUSES = ['open', 'in_review', 'planned', 'resolved', 'closed'];
const STATUS_COLOR: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  open: 'default', in_review: 'warning', planned: 'info', resolved: 'success', closed: 'error',
};

export default function FeedbackAdminPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [responding, setResponding] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [newStatus, setNewStatus] = useState('resolved');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCat) params.set('category', filterCat);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/v1/feedback?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterCat, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const vote = async (id: string) => {
    await fetch(`/api/v1/feedback/${id}/vote`, { method: 'POST' });
    load();
  };

  const respond = async (id: string) => {
    if (!responseText.trim()) return;
    await fetch(`/api/v1/feedback/${id}/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: responseText, status: newStatus }),
    });
    setResponding(null);
    setResponseText('');
    load();
  };

  return (
    <AppLayout title="Feedback Dashboard" subtitle="Review and respond to user feedback">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Category</InputLabel>
            <Select value={filterCat} label="Category" onChange={(e) => setFilterCat(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {['bug', 'feature', 'general', 'other'].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={filterStatus} label="Status" onChange={(e) => setFilterStatus(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        {/* List */}
        {loading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={100} sx={{ borderRadius: 1 }} />)
        ) : items.length === 0 ? (
          <Typography color="text.secondary">No feedback found.</Typography>
        ) : items.map((item) => (
          <Card key={item.id} variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip label={item.category} size="small" />
                  <Chip label={item.status} size="small" color={STATUS_COLOR[item.status] ?? 'default'} />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" onClick={() => vote(item.id)}>
                    ▲ {item.votes}
                  </Button>
                  <Button size="small" onClick={() => { setResponding(item.id); setResponseText(item.response ?? ''); }}>
                    Respond
                  </Button>
                </Box>
              </Box>

              <Typography sx={{ mt: 1 }}>{item.message}</Typography>
              {item.page && <Typography variant="caption" color="text.secondary">Page: {item.page}</Typography>}

              {item.response && (
                <Box sx={{ mt: 1, pl: 1, borderLeft: '3px solid', borderColor: 'primary.main' }}>
                  <Typography variant="body2" color="text.secondary">Team response: {item.response}</Typography>
                </Box>
              )}

              {responding === item.id && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <TextField
                      size="small" multiline rows={2} label="Response"
                      value={responseText} onChange={(e) => setResponseText(e.target.value)}
                    />
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Set status</InputLabel>
                        <Select value={newStatus} label="Set status" onChange={(e) => setNewStatus(e.target.value)}>
                          {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <Button variant="contained" size="small" onClick={() => respond(item.id)}>Save</Button>
                      <Button size="small" onClick={() => setResponding(null)}>Cancel</Button>
                    </Box>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    </AppLayout>
  );
}

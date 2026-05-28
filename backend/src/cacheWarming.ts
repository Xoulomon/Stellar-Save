import { set } from './redis';

const warmData = {
  '/api/retirements': [
    { id: 1, amount: 100, entity: 'Company A' },
    { id: 2, amount: 250, entity: 'Company B' },
  ],
  '/api/stats': { totalRetired: 350, totalTransactions: 2 },
};

export const startWarmingJob = async () => {
  console.log('🔥 Starting cache warming job...');
  
  for (const [endpoint, data] of Object.entries(warmData)) {
    await set(`cache:${endpoint}`, data, 3600);
    console.log(`Warmed: ${endpoint}`);
  }
  
  console.log('✅ Cache warming completed');
  
  setInterval(async () => {
    console.log('🔄 Running scheduled cache warming...');
    for (const [endpoint, data] of Object.entries(warmData)) {
      await set(`cache:${endpoint}`, data, 3600);
    }
  }, 3600000);
};
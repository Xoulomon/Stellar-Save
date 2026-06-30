import { ExportJob, ExportFormat, UserInteraction, UserPreference } from './models';
import { EmailService } from './email_service';
import { randomUUID } from 'crypto';

export class ExportService {
  private jobs: Map<string, ExportJob> = new Map();
  private emailService: EmailService;
  private interactions: UserInteraction[];
  private preferences: Map<string, UserPreference>;

  constructor(
    emailService: EmailService,
    interactions: UserInteraction[],
    preferences: Map<string, UserPreference>
  ) {
    this.emailService = emailService;
    this.interactions = interactions;
    this.preferences = preferences;

    // Start retention policy checker
    setInterval(() => this.cleanupOldJobs(), 3600000); // Every hour
  }

  async createJob(userId: string, email: string, format: ExportFormat): Promise<string> {
    const jobId = randomUUID();
    const job: ExportJob = {
      id: jobId,
      userId,
      format,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.jobs.set(jobId, job);
    
    // Trigger asynchronous processing
    this.processJob(jobId, email).catch(console.error);

    return jobId;
  }

  getJob(jobId: string): ExportJob | undefined {
    return this.jobs.get(jobId);
  }

  private async processJob(jobId: string, email: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'processing';

    try {
      // Simulate data fetching and processing delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const userData = {
        preferences: this.preferences.get(job.userId),
        interactions: this.interactions.filter(i => i.userId === job.userId)
      };

      let content: string;
      if (job.format === 'JSON') {
        content = JSON.stringify(userData, null, 2);
      } else {
        content = this.convertToCSV(userData);
      }

      // In a real app, we would upload to S3 or similar
      // For this mock, we'll just use a fake URL
      job.fileUrl = `https://stellar-save.exports/download/${jobId}.${job.format.toLowerCase()}`;
      job.status = 'completed';
      job.completedAt = Date.now();

      await this.emailService.sendExportEmail(email, job.fileUrl);
    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message;
    }
  }

  private convertToCSV(data: any): string {
    let csv = 'Type,ID,Value,Timestamp\n';
    
    if (data.preferences) {
      csv += `Preference,${data.preferences.userId},${data.preferences.tags.join('|')},${Date.now()}\n`;
    }

    data.interactions.forEach((i: UserInteraction) => {
      csv += `Interaction,${i.groupId},${i.interactionType},${i.timestamp}\n`;
    });

    return csv;
  }

  private cleanupOldJobs(): void {
    const now = Date.now();
    const retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours

    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt > retentionPeriod) {
        this.jobs.delete(id);
      }
    }
  }
}

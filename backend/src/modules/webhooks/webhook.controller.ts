// backend/src/modules/webhooks/webhook.controller.ts
import { Controller, Post, Get, Delete, Param, Body } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  async registerWebhook(@Body() body: any) {
    const userId = 'temp-user-id'; // TODO: Replace with real auth later
    return this.webhookService.registerWebhook(userId, body);
  }

  @Get()
  async getUserWebhooks() {
    const userId = 'temp-user-id';
    return this.webhookService.getUserWebhooks(userId);
  }

  @Delete(':id')
  async deleteWebhook(@Param('id') id: string) {
    const userId = 'temp-user-id';
    return this.webhookService.deleteWebhook(userId, id);
  }
}
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhookModule } from './modules/webhooks/webhook.module';
// Import other modules here later (e.g. AuthModule, PrismaModule, etc.)

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,           // Makes .env available everywhere
      envFilePath: '.env',
    }),
    WebhookModule,
    // Add other modules here as you build them
  ],
})
export class AppModule {}
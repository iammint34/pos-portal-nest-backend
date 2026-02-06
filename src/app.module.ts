import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StoresModule } from './stores/stores.module';
import { BranchesModule } from './branches/branches.module';
import { ItemsModule } from './items/items.module';
import { PosModule } from './pos/pos.module';
import { SyncModule } from './sync/sync.module';
import { RbacModule } from './rbac/rbac.module';
import { AuditModule } from './audit/audit.module';
import { SalesModule } from './sales/sales.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ReportsModule } from './reports/reports.module';
import { InventoryModule } from './inventory/inventory.module';
import { AlertsModule } from './alerts/alerts.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { CloneModule } from './clone/clone.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LossPreventionModule } from './loss-prevention/loss-prevention.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PosDeviceGuard } from './common/guards';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    StoresModule,
    BranchesModule,
    ItemsModule,
    PosModule,
    SyncModule,
    RbacModule,
    AuditModule,
    SalesModule,
    ShiftsModule,
    ReportsModule,
    InventoryModule,
    AlertsModule,
    FeatureFlagsModule,
    CloneModule,
    JobsModule.forRoot(),
    NotificationsModule,
    LossPreventionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PosDeviceGuard,
    },
  ],
})
export class AppModule {}

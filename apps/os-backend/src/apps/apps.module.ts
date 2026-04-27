import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../database/entities/application.entity';
import { UserAppAccess } from '../database/entities/user-app-access.entity';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';

@Module({
  imports: [TypeOrmModule.forFeature([Application, UserAppAccess])],
  controllers: [AppsController],
  providers: [AppsService],
})
export class AppsModule {}

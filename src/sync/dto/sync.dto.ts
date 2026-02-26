import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SyncType } from '@prisma/client';

export class SyncRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  deviceIdentifier: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  deviceToken: string;

  @ApiPropertyOptional({ enum: SyncType, default: SyncType.FULL })
  @IsOptional()
  @IsEnum(SyncType)
  syncType?: SyncType;

  @ApiPropertyOptional({
    description: 'Last known version for incremental sync',
  })
  @IsOptional()
  @IsNumber()
  lastVersion?: number;

  @ApiPropertyOptional({
    description: 'Last sync timestamp for incremental sync',
  })
  @IsOptional()
  @IsDateString()
  lastSyncAt?: string;
}

export class HeartbeatDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  deviceIdentifier: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  deviceToken: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appVersion?: string;
}

// User sync data
export class SyncUserDto {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: 'MANAGER' | 'STAFF';
  pin?: string;
  isActive: boolean;
  permissions?: string[];
}

// Category sync data
export class SyncCategoryDto {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

// Item sync data
export class SyncItemDto {
  id: string;
  categoryId?: string;
  sku?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  isActive: boolean;
  isAvailable: boolean;
  version: number;
}

// Deleted record for cleanup
export class DeletedRecordDto {
  id: string;
  deletedAt: Date;
}

export class SyncResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  version: number;

  @ApiPropertyOptional()
  users?: SyncUserDto[];

  @ApiPropertyOptional()
  categories?: SyncCategoryDto[];

  @ApiPropertyOptional()
  items?: SyncItemDto[];

  @ApiPropertyOptional({ description: 'Deleted user IDs for cleanup' })
  deletedUsers?: DeletedRecordDto[];

  @ApiPropertyOptional({ description: 'Deleted category IDs for cleanup' })
  deletedCategories?: DeletedRecordDto[];

  @ApiPropertyOptional({ description: 'Deleted item IDs for cleanup' })
  deletedItems?: DeletedRecordDto[];

  @ApiProperty()
  syncedAt: Date;

  @ApiProperty()
  storeId: string;

  @ApiProperty()
  branchId: string;
}

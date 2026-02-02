import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AlertType, AlertSeverity } from '@prisma/client';

export class AlertQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ enum: AlertType })
  @IsOptional()
  @IsEnum(AlertType)
  type?: AlertType;

  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @ApiPropertyOptional({
    enum: ['active', 'acknowledged', 'dismissed', 'all'],
    default: 'active',
  })
  @IsOptional()
  @IsString()
  status?: 'active' | 'acknowledged' | 'dismissed' | 'all';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class BulkDismissDto {
  @ApiProperty({ type: [String], description: 'Array of alert IDs to dismiss' })
  @IsArray()
  @IsUUID('4', { each: true })
  alertIds: string[];
}

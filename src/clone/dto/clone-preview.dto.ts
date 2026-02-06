import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CloneType } from '../clone.constants';

export class ClonePreviewDto {
  @ApiProperty({ description: 'Type of clone operation', enum: CloneType })
  @IsEnum(CloneType)
  type: CloneType;

  @ApiProperty({ description: 'Source entity ID (store or branch)' })
  @IsString()
  sourceId: string;

  @ApiPropertyOptional({ description: 'Clone configuration options' })
  @IsOptional()
  @IsObject()
  config?: Record<string, boolean>;
}

// Response types
export interface ClonePreviewItem {
  element: string;
  count: number;
  willClone: boolean;
}

export interface ClonePreviewResponse {
  type: CloneType;
  sourceName: string;
  sourceId: string;
  elements: ClonePreviewItem[];
  totalItems: number;
  estimatedTime: string;
}

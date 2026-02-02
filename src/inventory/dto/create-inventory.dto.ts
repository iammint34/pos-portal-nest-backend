import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateInventoryDto {
  @ApiProperty({ description: 'Item ID to track inventory for' })
  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ description: 'Branch ID where inventory is tracked' })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiPropertyOptional({ description: 'Initial quantity', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialQuantity?: number;

  @ApiPropertyOptional({ description: 'Low stock threshold for alerts' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ description: 'Whether to track inventory for this item', default: true })
  @IsOptional()
  @IsBoolean()
  isTracked?: boolean;
}

export class BulkCreateInventoryDto {
  @ApiProperty({ description: 'Branch ID for all items' })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: 'Array of item IDs to create inventory for', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  itemIds: string[];

  @ApiPropertyOptional({ description: 'Default low stock threshold for all items' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultLowStockThreshold?: number;
}

export class UpdateInventoryDto {
  @ApiPropertyOptional({ description: 'Low stock threshold for alerts' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ description: 'Whether to track inventory for this item' })
  @IsOptional()
  @IsBoolean()
  isTracked?: boolean;
}

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ReceiveStockItemDto {
  @ApiProperty({ description: 'Item ID' })
  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ description: 'Quantity received' })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class ReceiveStockDto {
  @ApiProperty({ description: 'Branch Inventory ID' })
  @IsUUID()
  @IsNotEmpty()
  inventoryId: string;

  @ApiProperty({ description: 'Quantity received' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: 'Reference number (e.g., PO number)' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'Notes about the receipt' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkReceiveStockDto {
  @ApiProperty({ description: 'Branch ID to receive stock' })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: 'Items to receive', type: [ReceiveStockItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveStockItemDto)
  items: ReceiveStockItemDto[];

  @ApiPropertyOptional({ description: 'Reference number (e.g., PO number)' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'Notes about the receipt' })
  @IsOptional()
  @IsString()
  notes?: string;
}

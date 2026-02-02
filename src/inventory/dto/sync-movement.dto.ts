import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SyncMovementType {
  RECEIVED = 'RECEIVED',
  SOLD = 'SOLD',
  ADJUSTED_UP = 'ADJUSTED_UP',
  ADJUSTED_DOWN = 'ADJUSTED_DOWN',
  WASTED = 'WASTED',
  VOIDED_SALE = 'VOIDED_SALE',
  REFUNDED = 'REFUNDED',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
}

export class SyncMovementDto {
  @ApiProperty({ description: 'Unique movement ID from POS for idempotency' })
  @IsString()
  @IsNotEmpty()
  movementId: string;

  @ApiProperty({ description: 'Portal Item ID' })
  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ description: 'Movement type', enum: SyncMovementType })
  @IsEnum(SyncMovementType)
  movementType: SyncMovementType;

  @ApiProperty({ description: 'Quantity moved (positive number)' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Quantity before this movement' })
  @IsNumber()
  previousQuantity: number;

  @ApiProperty({ description: 'Quantity after this movement' })
  @IsNumber()
  newQuantity: number;

  @ApiPropertyOptional({ description: 'Reference type (ORDER, REFUND, etc.)' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Reference ID (order ID, etc.)' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'POS Device ID that created the movement' })
  @IsOptional()
  @IsString()
  posDeviceId?: string;

  @ApiPropertyOptional({ description: 'Reason for movement' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'User ID who performed the movement' })
  @IsOptional()
  @IsString()
  performedBy?: string;

  @ApiProperty({ description: 'When the movement was performed on POS' })
  @IsDateString()
  performedAt: string;
}

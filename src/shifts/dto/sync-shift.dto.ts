import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsDateString,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ShiftStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum CashMovementType {
  OPENING_FLOAT = 'OPENING_FLOAT',
  CASH_SALE = 'CASH_SALE',
  CHANGE_GIVEN = 'CHANGE_GIVEN',
  TIP_CASH = 'TIP_CASH',
  PAID_OUT = 'PAID_OUT',
  DROP = 'DROP',
  CASH_IN = 'CASH_IN',
  REFUND = 'REFUND',
  CLOSING_COUNT = 'CLOSING_COUNT',
}

// ========== Cash Movement DTO ==========
export class SyncCashMovementDto {
  @ApiProperty({ enum: CashMovementType, description: 'Type of cash movement' })
  @IsEnum(CashMovementType)
  movementType: CashMovementType;

  @ApiProperty({ description: 'Amount of movement (positive or negative)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  amount: number;

  @ApiPropertyOptional({ description: 'Reference type (e.g., Order)' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Reference ID (e.g., order ID)' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Reason for movement' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ description: 'User who performed the movement' })
  @IsString()
  @IsNotEmpty()
  performedBy: string;

  @ApiProperty({ description: 'When movement was performed' })
  @IsDateString()
  performedAt: string;
}

// ========== Main Shift DTO ==========
export class SyncShiftDto {
  @ApiProperty({ description: 'Unique shift ID from POS (for idempotency)' })
  @IsString()
  @IsNotEmpty()
  posShiftId: string;

  @ApiProperty({ description: 'POS operator ID' })
  @IsString()
  @IsNotEmpty()
  posOperatorId: string;

  @ApiProperty({ enum: ShiftStatus, description: 'Shift status' })
  @IsEnum(ShiftStatus)
  status: ShiftStatus;

  @ApiProperty({ description: 'When shift was opened' })
  @IsDateString()
  openedAt: string;

  @ApiPropertyOptional({ description: 'When shift was closed' })
  @IsOptional()
  @IsDateString()
  closedAt?: string;

  @ApiProperty({ description: 'Opening cash amount' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingCash: number;

  @ApiPropertyOptional({ description: 'Closing cash amount (counted)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  closingCash?: number;

  @ApiPropertyOptional({ description: 'Expected cash amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  expectedCash?: number;

  @ApiPropertyOptional({ description: 'Cash variance (closing - expected)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  variance?: number;

  @ApiPropertyOptional({ description: 'Notes for the shift' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: [SyncCashMovementDto],
    description: 'Cash movements during shift',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncCashMovementDto)
  cashMovements: SyncCashMovementDto[];

  @ApiProperty({ description: 'Number of orders during shift' })
  @IsNumber()
  @Min(0)
  orderCount: number;
}

// ========== Response Types ==========
export interface SyncShiftResult {
  success: boolean;
  posShiftId: string;
  shiftId?: string;
  error?: string;
  isNew: boolean;
}

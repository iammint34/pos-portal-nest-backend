import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsDateString,
  ValidateNested,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums matching Prisma schema
export enum OrderStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  VOIDED = 'VOIDED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  EWALLET = 'EWALLET',
  OTHER = 'OTHER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum VoidRefundType {
  VOID = 'VOID',
  REFUND = 'REFUND',
  PARTIAL_REFUND = 'PARTIAL_REFUND',
}

// ========== Order Item DTO ==========
export class SyncOrderItemDto {
  @ApiPropertyOptional({ description: 'Item ID from catalog (optional if item deleted)' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiProperty({ description: 'Item name at time of sale' })
  @IsString()
  @IsNotEmpty()
  itemName: string;

  @ApiPropertyOptional({ description: 'Item SKU at time of sale' })
  @IsOptional()
  @IsString()
  itemSku?: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 9.99 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiProperty({ example: 19.98, description: 'Total after discount' })
  @IsNumber()
  @Min(0)
  totalPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ========== Order Discount DTO ==========
export class SyncOrderDiscountDto {
  @ApiProperty({ example: 'Senior Citizen Discount' })
  @IsString()
  @IsNotEmpty()
  discountName: string;

  @ApiProperty({ example: 'PERCENTAGE', description: 'PERCENTAGE or FIXED' })
  @IsString()
  @IsNotEmpty()
  discountType: string;

  @ApiProperty({ example: 20, description: 'Percentage value or fixed amount' })
  @IsNumber()
  @Min(0)
  discountValue: number;

  @ApiProperty({ example: 10.5, description: 'Actual amount deducted' })
  @IsNumber()
  @Min(0)
  discountAmount: number;
}

// ========== Payment DTO ==========
export class SyncPaymentDto {
  @ApiProperty({ description: 'Unique payment ID from POS' })
  @IsString()
  @IsNotEmpty()
  posPaymentId: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentStatus, default: PaymentStatus.COMPLETED })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiProperty({ example: 50.00 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 100.00, description: 'Amount tendered (for cash)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tenderedAmount?: number;

  @ApiPropertyOptional({ example: 50.00, description: 'Change given (for cash)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  changeAmount?: number;

  @ApiPropertyOptional({ description: 'Reference number for card/ewallet' })
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiProperty({ description: 'When payment was made on POS' })
  @IsDateString()
  posCreatedAt: string;
}

// ========== Void/Refund DTO ==========
export class SyncVoidRefundDto {
  @ApiProperty({ description: 'Unique void/refund ID from POS' })
  @IsString()
  @IsNotEmpty()
  posVoidId: string;

  @ApiProperty({ enum: VoidRefundType })
  @IsEnum(VoidRefundType)
  type: VoidRefundType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ example: 25.00 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'User who processed the void/refund' })
  @IsOptional()
  @IsString()
  processedBy?: string;

  @ApiProperty({ description: 'When void/refund was processed on POS' })
  @IsDateString()
  posCreatedAt: string;
}

// ========== Order DTO ==========
export class SyncOrderDto {
  @ApiProperty({ description: 'Unique order ID from POS (for idempotency)' })
  @IsString()
  @IsNotEmpty()
  posOrderId: string;

  @ApiProperty({ example: 'ORD-2024-001' })
  @IsString()
  @IsNotEmpty()
  orderNumber: string;

  @ApiPropertyOptional({ enum: OrderStatus, default: OrderStatus.COMPLETED })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({ example: 100.00 })
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiPropertyOptional({ example: 10.00, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountTotal?: number;

  @ApiPropertyOptional({ example: 12.00, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxTotal?: number;

  @ApiProperty({ example: 102.00 })
  @IsNumber()
  @Min(0)
  grandTotal: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'When order was created on POS' })
  @IsDateString()
  posCreatedAt: string;

  @ApiProperty({ type: [SyncOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncOrderItemDto)
  items: SyncOrderItemDto[];

  @ApiPropertyOptional({ type: [SyncOrderDiscountDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncOrderDiscountDto)
  discounts?: SyncOrderDiscountDto[];

  @ApiProperty({ type: [SyncPaymentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncPaymentDto)
  payments: SyncPaymentDto[];

  @ApiPropertyOptional({ type: [SyncVoidRefundDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncVoidRefundDto)
  voidRefunds?: SyncVoidRefundDto[];
}

// ========== Batch Sync Request DTO ==========
export class SyncSalesBatchDto {
  @ApiProperty({ description: 'Unique batch ID from POS (for idempotency)' })
  @IsString()
  @IsNotEmpty()
  batchId: string;

  @ApiProperty({ type: [SyncOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncOrderDto)
  orders: SyncOrderDto[];
}

// ========== Response DTOs ==========
export class SyncOrderResultDto {
  posOrderId: string;
  orderId: string;
  status: 'created' | 'existing' | 'failed';
  error?: string;
}

export class SyncSalesBatchResponseDto {
  batchId: string;
  syncStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  totalOrders: number;
  createdOrders: number;
  existingOrders: number;
  failedOrders: number;
  results: SyncOrderResultDto[];
}

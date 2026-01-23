import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  IsEnum,
  IsDateString,
  ValidateNested,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums matching Prisma schema
export enum OrderType {
  DINE_IN = 'DINE_IN',
  TAKEOUT = 'TAKEOUT',
  DELIVERY = 'DELIVERY',
  DRIVE_THRU = 'DRIVE_THRU',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  VOIDED = 'VOIDED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  MOBILE_PAYMENT = 'MOBILE_PAYMENT',
  GIFT_CARD = 'GIFT_CARD',
  STORE_CREDIT = 'STORE_CREDIT',
  OTHER = 'OTHER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export enum DiscountScope {
  ORDER = 'ORDER',
  ITEM = 'ITEM',
}

// ========== Order Item DTO ==========
export class SyncOrderItemDto {
  @ApiPropertyOptional({ description: 'Reference to item in POS system' })
  @IsOptional()
  @IsString()
  posItemId?: string;

  @ApiPropertyOptional({ description: 'Reference to Item ID in backend if exists' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiProperty({ description: 'Item name (denormalized for historical accuracy)' })
  @IsString()
  @IsNotEmpty()
  itemName: string;

  @ApiPropertyOptional({ description: 'Item SKU' })
  @IsOptional()
  @IsString()
  itemSku?: string;

  @ApiProperty({ description: 'Quantity ordered', minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Unit price of the item' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ description: 'Discount amount on this item', default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Tax amount on this item', default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxAmount?: number;

  @ApiProperty({ description: 'Total price (quantity * unitPrice - discount + tax)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalPrice: number;

  @ApiPropertyOptional({ description: 'Special instructions or notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Whether this item was voided', default: false })
  @IsOptional()
  @IsBoolean()
  isVoided?: boolean;

  @ApiPropertyOptional({ description: 'Reason for voiding' })
  @IsOptional()
  @IsString()
  voidReason?: string;
}

// ========== Order Discount DTO ==========
export class SyncOrderDiscountDto {
  @ApiPropertyOptional({ description: 'Index of order item this discount applies to (null for order-level)' })
  @IsOptional()
  @IsNumber()
  orderItemIndex?: number;

  @ApiProperty({ description: 'Name of the discount' })
  @IsString()
  @IsNotEmpty()
  discountName: string;

  @ApiProperty({ enum: DiscountType, description: 'Type of discount' })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty({ enum: DiscountScope, description: 'Scope of discount (order or item level)' })
  @IsEnum(DiscountScope)
  discountScope: DiscountScope;

  @ApiProperty({ description: 'Discount value (percentage or fixed amount)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue: number;

  @ApiProperty({ description: 'Actual amount discounted' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount: number;

  @ApiPropertyOptional({ description: 'Reason for discount' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'User who applied the discount' })
  @IsOptional()
  @IsString()
  appliedBy?: string;
}

// ========== Payment DTO ==========
export class SyncPaymentDto {
  @ApiProperty({ description: 'Unique payment ID from POS' })
  @IsString()
  @IsNotEmpty()
  posPaymentId: string;

  @ApiProperty({ enum: PaymentMethod, description: 'Payment method used' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentStatus, description: 'Payment status', default: 'COMPLETED' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiProperty({ description: 'Payment amount' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Tip amount', default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tipAmount?: number;

  @ApiPropertyOptional({ description: 'Change given (for cash payments)', default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  changeAmount?: number;

  @ApiPropertyOptional({ description: 'Reference number (card last 4, transaction ID, etc.)' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiProperty({ description: 'When payment was processed' })
  @IsDateString()
  processedAt: string;
}

// ========== Refund DTO ==========
export class SyncRefundDto {
  @ApiProperty({ description: 'Unique refund ID from POS' })
  @IsString()
  @IsNotEmpty()
  posRefundId: string;

  @ApiPropertyOptional({ description: 'POS Payment ID being refunded' })
  @IsOptional()
  @IsString()
  posPaymentId?: string;

  @ApiProperty({ description: 'Refund amount' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Reason for refund' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ enum: PaymentMethod, description: 'How refund was issued' })
  @IsEnum(PaymentMethod)
  refundMethod: PaymentMethod;

  @ApiPropertyOptional({ description: 'User who processed the refund' })
  @IsOptional()
  @IsString()
  processedBy?: string;

  @ApiProperty({ description: 'When refund was processed' })
  @IsDateString()
  processedAt: string;
}

// ========== Main Order DTO ==========
export class SyncOrderDto {
  @ApiProperty({ description: 'Unique order ID from POS (for idempotency)' })
  @IsString()
  @IsNotEmpty()
  posOrderId: string;

  @ApiProperty({ description: 'Human-readable order number' })
  @IsString()
  @IsNotEmpty()
  orderNumber: string;

  @ApiPropertyOptional({ enum: OrderType, description: 'Type of order', default: 'DINE_IN' })
  @IsOptional()
  @IsEnum(OrderType)
  orderType?: OrderType;

  @ApiPropertyOptional({ enum: OrderStatus, description: 'Order status', default: 'COMPLETED' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({ description: 'Order subtotal before discounts and tax' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal: number;

  @ApiPropertyOptional({ description: 'Total discount amount', default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountTotal?: number;

  @ApiPropertyOptional({ description: 'Total tax amount', default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxTotal?: number;

  @ApiProperty({ description: 'Grand total (subtotal - discount + tax)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  grandTotal: number;

  // BIR VAT Breakdown
  @ApiPropertyOptional({ description: 'VATable portion of sales', default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  vatableSales?: number;

  @ApiPropertyOptional({ description: '12% VAT amount', default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  vatAmount?: number;

  @ApiPropertyOptional({ description: 'VAT-exempt sales amount', default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  vatExemptSales?: number;

  @ApiPropertyOptional({ description: 'Zero-rated sales amount', default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  zeroRatedSales?: number;

  @ApiPropertyOptional({ description: 'Customer name' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: 'Customer phone number' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'Order notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'When order was created on POS' })
  @IsDateString()
  posCreatedAt: string;

  @ApiPropertyOptional({ description: 'When order was closed on POS' })
  @IsOptional()
  @IsDateString()
  posClosedAt?: string;

  @ApiProperty({ type: [SyncOrderItemDto], description: 'Order items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncOrderItemDto)
  items: SyncOrderItemDto[];

  @ApiPropertyOptional({ type: [SyncOrderDiscountDto], description: 'Order discounts' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncOrderDiscountDto)
  discounts?: SyncOrderDiscountDto[];

  @ApiPropertyOptional({ type: [SyncPaymentDto], description: 'Payments' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncPaymentDto)
  payments?: SyncPaymentDto[];

  @ApiPropertyOptional({ type: [SyncRefundDto], description: 'Refunds' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncRefundDto)
  refunds?: SyncRefundDto[];
}

// ========== Batch Sync DTO ==========
export class SyncOrdersBatchDto {
  @ApiPropertyOptional({ description: 'Batch identifier for tracking' })
  @IsOptional()
  @IsString()
  syncBatchId?: string;

  @ApiProperty({ type: [SyncOrderDto], description: 'Orders to sync' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncOrderDto)
  orders: SyncOrderDto[];
}

// ========== Void Order DTO ==========
export class VoidOrderDto {
  @ApiProperty({ description: 'POS Order ID to void' })
  @IsString()
  @IsNotEmpty()
  posOrderId: string;

  @ApiPropertyOptional({ description: 'Reason for voiding' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'User who voided the order' })
  @IsOptional()
  @IsString()
  voidedBy?: string;
}

// ========== Response Types ==========

export interface SyncResult {
  success: boolean;
  posOrderId: string;
  orderId?: string;
  error?: string;
  isNew: boolean;
}

export interface BatchSyncResult {
  syncBatchId: string;
  totalOrders: number;
  successful: number;
  failed: number;
  skipped: number;
  results: SyncResult[];
}

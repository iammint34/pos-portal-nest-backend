import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsInt, Min, IsEnum, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
}

// Query DTOs
export class DateRangeDto {
  @ApiPropertyOptional({ description: 'Start date (ISO string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ReportQueryDto extends DateRangeDto {
  @ApiPropertyOptional({ description: 'Store ID (optional for multi-store owners)' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Branch ID filter' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'POS Device ID filter' })
  @IsOptional()
  @IsString()
  posDeviceId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Number of top items to return (for top-items endpoint)', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  top?: number;
}

export class ExportQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({ enum: ExportFormat, default: ExportFormat.JSON })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat = ExportFormat.JSON;
}

// Response DTOs
export class SalesSummaryDto {
  @ApiProperty() totalOrders: number;
  @ApiProperty() completedOrders: number;
  @ApiProperty() voidedOrders: number;
  @ApiProperty() grossSales: number;
  @ApiProperty() totalDiscounts: number;
  @ApiProperty() totalRefunds: number;
  @ApiProperty() netSales: number;
  @ApiProperty() totalTax: number;
  @ApiProperty() vatableSales: number;
  @ApiProperty() vatAmount: number;
  @ApiProperty() vatExemptSales: number;
  @ApiProperty() zeroRatedSales: number;
  @ApiProperty() cashSales: number;
  @ApiProperty() cardSales: number;
  @ApiProperty() otherSales: number;
  @ApiProperty() averageOrderValue: number;
  @ApiProperty() periodStart: string;
  @ApiProperty() periodEnd: string;
}

export class SalesByBranchDto {
  @ApiProperty() branchId: string;
  @ApiProperty() branchName: string;
  @ApiProperty() orderCount: number;
  @ApiProperty() grossSales: number;
  @ApiProperty() discounts: number;
  @ApiProperty() refunds: number;
  @ApiProperty() netSales: number;
  @ApiProperty() percentage: number;
}

export class SalesByDeviceDto {
  @ApiProperty() posDeviceId: string;
  @ApiProperty() deviceName: string;
  @ApiProperty() branchName: string;
  @ApiProperty() orderCount: number;
  @ApiProperty() grossSales: number;
  @ApiProperty() discounts: number;
  @ApiProperty() netSales: number;
  @ApiProperty() percentage: number;
}

export class SalesByCategoryDto {
  @ApiProperty() categoryId: string;
  @ApiProperty() categoryName: string;
  @ApiProperty() itemCount: number;
  @ApiProperty() quantitySold: number;
  @ApiProperty() grossSales: number;
  @ApiProperty() discounts: number;
  @ApiProperty() netSales: number;
  @ApiProperty() percentage: number;
}

export class SalesByItemDto {
  @ApiProperty() itemId: string;
  @ApiProperty() itemName: string;
  @ApiPropertyOptional() itemSku?: string;
  @ApiPropertyOptional() categoryName?: string;
  @ApiProperty() quantitySold: number;
  @ApiProperty() grossSales: number;
  @ApiProperty() discounts: number;
  @ApiProperty() netSales: number;
  @ApiProperty() averagePrice: number;
}

export class SalesByPaymentMethodDto {
  @ApiProperty() paymentMethod: string;
  @ApiProperty() transactionCount: number;
  @ApiProperty() totalAmount: number;
  @ApiProperty() tipAmount: number;
  @ApiProperty() percentage: number;
}

export class SalesByHourDto {
  @ApiProperty() hour: number;
  @ApiProperty() hourLabel: string;
  @ApiProperty() orderCount: number;
  @ApiProperty() totalSales: number;
  @ApiProperty() itemsSold: number;
}

export class SalesTrendDto {
  @ApiProperty() date: string;
  @ApiProperty() orderCount: number;
  @ApiProperty() grossSales: number;
  @ApiProperty() netSales: number;
}

export class TransactionDto {
  @ApiProperty() id: string;
  @ApiProperty() orderNumber: string;
  @ApiPropertyOptional() invoiceNumber?: string;
  @ApiProperty() orderType: string;
  @ApiProperty() status: string;
  @ApiPropertyOptional() customerName?: string;
  @ApiProperty() subtotal: number;
  @ApiProperty() discountTotal: number;
  @ApiProperty() taxTotal: number;
  @ApiProperty() grandTotal: number;
  @ApiProperty() itemCount: number;
  @ApiPropertyOptional() paymentMethod?: string;
  @ApiProperty() branchName: string;
  @ApiProperty() deviceName: string;
  @ApiProperty() createdAt: string;
  @ApiPropertyOptional() closedAt?: string;
}

export class VoidedTransactionDto {
  @ApiProperty() id: string;
  @ApiProperty() orderNumber: string;
  @ApiPropertyOptional() invoiceNumber?: string;
  @ApiProperty() originalTotal: number;
  @ApiPropertyOptional() voidReason?: string;
  @ApiProperty() branchName: string;
  @ApiProperty() deviceName: string;
  @ApiProperty() voidedAt: string;
}

export class RefundReportDto {
  @ApiProperty() id: string;
  @ApiProperty() orderId: string;
  @ApiProperty() orderNumber: string;
  @ApiProperty() paymentMethod: string;
  @ApiProperty() refundMethod: string;
  @ApiProperty() amount: number;
  @ApiPropertyOptional() reason?: string;
  @ApiPropertyOptional() processedBy?: string;
  @ApiProperty() branchName: string;
  @ApiProperty() processedAt: string;
}

export class DiscountReportDto {
  @ApiProperty() discountName: string;
  @ApiProperty() discountType: string;
  @ApiProperty() discountScope: string;
  @ApiProperty() timesApplied: number;
  @ApiProperty() totalDiscountAmount: number;
  @ApiProperty() ordersAffected: number;
}

export class ShiftReportDto {
  @ApiProperty() id: string;
  @ApiProperty() operatorName: string;
  @ApiProperty() branchName: string;
  @ApiProperty() deviceName: string;
  @ApiProperty() status: string;
  @ApiProperty() openedAt: string;
  @ApiPropertyOptional() closedAt?: string;
  @ApiPropertyOptional() duration?: string;
  @ApiProperty() openingCash: number;
  @ApiPropertyOptional() closingCash?: number;
  @ApiProperty() expectedCash: number;
  @ApiPropertyOptional() variance?: number;
  @ApiProperty() orderCount: number;
  @ApiProperty() totalSales: number;
}

export class ZReadingReportDto {
  @ApiProperty() id: string;
  @ApiProperty() zCounterNo: number;
  @ApiProperty() branchName: string;
  @ApiProperty() deviceName: string;
  @ApiProperty() readingDate: string;
  @ApiProperty() beginningInvoice: string;
  @ApiProperty() endingInvoice: string;
  @ApiProperty() openingGrandTotal: number;
  @ApiProperty() closingGrandTotal: number;
  @ApiProperty() grossSales: number;
  @ApiProperty() netSales: number;
  @ApiProperty() vatableSales: number;
  @ApiProperty() vatAmount: number;
  @ApiProperty() vatExemptSales: number;
  @ApiProperty() zeroRatedSales: number;
  @ApiProperty() totalDiscounts: number;
  @ApiProperty() totalRefunds: number;
  @ApiProperty() totalVoids: number;
  @ApiProperty() transactionCount: number;
}

export class StaffSalesDto {
  @ApiProperty() operatorId: string;
  @ApiProperty() operatorName: string;
  @ApiProperty() orderCount: number;
  @ApiProperty() grossSales: number;
  @ApiProperty() discounts: number;
  @ApiProperty() netSales: number;
  @ApiProperty() averageOrderValue: number;
  @ApiProperty() percentage: number;
}

export class StaffPerformanceDto {
  @ApiProperty() operatorId: string;
  @ApiProperty() operatorName: string;
  @ApiProperty() orderCount: number;
  @ApiProperty() totalSales: number;
  @ApiProperty() averageOrderValue: number;
  @ApiProperty() voidCount: number;
  @ApiProperty() voidAmount: number;
  @ApiProperty() refundCount: number;
  @ApiProperty() refundAmount: number;
  @ApiProperty() discountCount: number;
  @ApiProperty() discountAmount: number;
  @ApiProperty() shiftCount: number;
  @ApiProperty() totalShiftHours: number;
  @ApiProperty() cashVariance: number;
}

export class TopSellingItemDto {
  @ApiProperty() itemId: string;
  @ApiProperty() itemName: string;
  @ApiPropertyOptional() itemSku?: string;
  @ApiPropertyOptional() categoryName?: string;
  @ApiProperty() quantitySold: number;
  @ApiProperty() revenue: number;
  @ApiProperty() rank: number;
}

export class DashboardStatsDto {
  @ApiProperty() todaySales: number;
  @ApiProperty() todayOrders: number;
  @ApiProperty() todayAvgOrder: number;
  @ApiProperty() yesterdaySales: number;
  @ApiProperty() yesterdayOrders: number;
  @ApiProperty() weekSales: number;
  @ApiProperty() weekOrders: number;
  @ApiProperty() monthSales: number;
  @ApiProperty() monthOrders: number;
  @ApiProperty() salesGrowth: number; // Percentage change from yesterday
  @ApiProperty() ordersGrowth: number;
}

// Pagination wrapper
export class PaginatedResponseDto<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Sync Z-Reading DTO (from POS Device)
export class SyncZReadingDto {
  @ApiProperty()
  @IsString()
  posZReadingId: string;

  @ApiProperty()
  @IsNumber()
  zCounterNo: number;

  @ApiProperty()
  @IsString()
  beginningInvoiceNo: string;

  @ApiProperty()
  @IsString()
  endingInvoiceNo: string;

  @ApiProperty()
  @IsNumber()
  beginningGrandTotal: number;

  @ApiProperty()
  @IsNumber()
  endingGrandTotal: number;

  @ApiProperty()
  @IsNumber()
  grossSales: number;

  @ApiProperty()
  @IsNumber()
  netSales: number;

  @ApiProperty()
  @IsNumber()
  vatableSales: number;

  @ApiProperty()
  @IsNumber()
  vatAmount: number;

  @ApiProperty()
  @IsNumber()
  vatExemptSales: number;

  @ApiProperty()
  @IsNumber()
  zeroRatedSales: number;

  @ApiProperty()
  @IsNumber()
  discountTotal: number;

  @ApiProperty()
  @IsNumber()
  refundTotal: number;

  @ApiProperty()
  @IsNumber()
  voidTotal: number;

  @ApiProperty()
  @IsInt()
  transactionCount: number;

  @ApiProperty()
  @IsInt()
  voidCount: number;

  @ApiProperty()
  @IsInt()
  refundCount: number;

  @ApiProperty()
  @IsString()
  closedBy: string;

  @ApiProperty()
  @IsString()
  closedAt: string;
}

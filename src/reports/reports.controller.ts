import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { Permissions, CurrentUser, CurrentUserData, PosDevice, CurrentPosDevice } from '../common/decorators';
import { PosDeviceGuard } from '../common/guards';
import {
  ReportQueryDto,
  ExportQueryDto,
  ExportFormat,
  SyncZReadingDto,
} from './dto';

@ApiTags('reports')
@Controller('reports')
@ApiBearerAuth('JWT-auth')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ==================== DASHBOARD ====================

  @Get('dashboard')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get dashboard stats' })
  @ApiQuery({ name: 'storeId', required: false })
  async getDashboardStats(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
  ) {
    const effectiveStoreId = user?.storeId || storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getDashboardStats(effectiveStoreId);
  }

  // ==================== SALES SUMMARY ====================

  @Get('sales/summary')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get sales summary for a period' })
  async getSalesSummary(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getSalesSummary(effectiveStoreId, dto);
  }

  @Get('sales/summary/export')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Export sales summary to CSV' })
  async exportSalesSummary(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ExportQueryDto,
    @Res() res: Response,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');

    const data = await this.reportsService.getSalesSummary(effectiveStoreId, dto);

    if (dto.format === ExportFormat.CSV) {
      const csv = this.reportsService.exportToCsv([data], [
        { key: 'periodStart', header: 'Period Start' },
        { key: 'periodEnd', header: 'Period End' },
        { key: 'totalOrders', header: 'Total Orders' },
        { key: 'completedOrders', header: 'Completed Orders' },
        { key: 'voidedOrders', header: 'Voided Orders' },
        { key: 'grossSales', header: 'Gross Sales' },
        { key: 'totalDiscounts', header: 'Total Discounts' },
        { key: 'totalRefunds', header: 'Total Refunds' },
        { key: 'netSales', header: 'Net Sales' },
        { key: 'totalTax', header: 'Total Tax' },
        { key: 'vatableSales', header: 'VATable Sales' },
        { key: 'vatAmount', header: 'VAT Amount' },
        { key: 'vatExemptSales', header: 'VAT Exempt Sales' },
        { key: 'zeroRatedSales', header: 'Zero Rated Sales' },
        { key: 'cashSales', header: 'Cash Sales' },
        { key: 'cardSales', header: 'Card Sales' },
        { key: 'otherSales', header: 'Other Sales' },
        { key: 'averageOrderValue', header: 'Average Order Value' },
      ]);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=sales-summary-${dto.startDate || 'all'}.csv`);
      return res.send(csv);
    }

    return res.json(data);
  }

  // ==================== SALES BY BRANCH ====================

  @Get('sales/by-branch')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get sales breakdown by branch' })
  async getSalesByBranch(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getSalesByBranch(effectiveStoreId, dto);
  }

  @Get('sales/by-branch/export')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Export sales by branch to CSV' })
  async exportSalesByBranch(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ExportQueryDto,
    @Res() res: Response,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');

    const data = await this.reportsService.getSalesByBranch(effectiveStoreId, dto);

    if (dto.format === ExportFormat.CSV) {
      const csv = this.reportsService.exportToCsv(data, [
        { key: 'branchName', header: 'Branch' },
        { key: 'orderCount', header: 'Orders' },
        { key: 'grossSales', header: 'Gross Sales' },
        { key: 'discounts', header: 'Discounts' },
        { key: 'refunds', header: 'Refunds' },
        { key: 'netSales', header: 'Net Sales' },
        { key: 'percentage', header: 'Percentage (%)' },
      ]);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=sales-by-branch-${dto.startDate || 'all'}.csv`);
      return res.send(csv);
    }

    return res.json(data);
  }

  // ==================== SALES BY DEVICE ====================

  @Get('sales/by-device')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get sales breakdown by POS device' })
  async getSalesByDevice(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getSalesByDevice(effectiveStoreId, dto);
  }

  // ==================== SALES BY CATEGORY ====================

  @Get('sales/by-category')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get sales breakdown by category' })
  async getSalesByCategory(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getSalesByCategory(effectiveStoreId, dto);
  }

  @Get('sales/by-category/export')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Export sales by category to CSV' })
  async exportSalesByCategory(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ExportQueryDto,
    @Res() res: Response,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');

    const data = await this.reportsService.getSalesByCategory(effectiveStoreId, dto);

    if (dto.format === ExportFormat.CSV) {
      const csv = this.reportsService.exportToCsv(data, [
        { key: 'categoryName', header: 'Category' },
        { key: 'itemCount', header: 'Items' },
        { key: 'quantitySold', header: 'Quantity Sold' },
        { key: 'grossSales', header: 'Gross Sales' },
        { key: 'discounts', header: 'Discounts' },
        { key: 'netSales', header: 'Net Sales' },
        { key: 'percentage', header: 'Percentage (%)' },
      ]);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=sales-by-category-${dto.startDate || 'all'}.csv`);
      return res.send(csv);
    }

    return res.json(data);
  }

  // ==================== SALES BY ITEM ====================

  @Get('sales/by-item')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get sales breakdown by item' })
  async getSalesByItem(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getSalesByItem(effectiveStoreId, dto);
  }

  @Get('sales/by-item/export')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Export sales by item to CSV' })
  async exportSalesByItem(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ExportQueryDto,
    @Res() res: Response,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');

    const result = await this.reportsService.getSalesByItem(effectiveStoreId, { ...dto, limit: 10000 });

    if (dto.format === ExportFormat.CSV) {
      const csv = this.reportsService.exportToCsv(result.data, [
        { key: 'itemName', header: 'Item Name' },
        { key: 'itemSku', header: 'SKU' },
        { key: 'categoryName', header: 'Category' },
        { key: 'quantitySold', header: 'Quantity Sold' },
        { key: 'grossSales', header: 'Gross Sales' },
        { key: 'discounts', header: 'Discounts' },
        { key: 'netSales', header: 'Net Sales' },
        { key: 'averagePrice', header: 'Average Price' },
      ]);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=sales-by-item-${dto.startDate || 'all'}.csv`);
      return res.send(csv);
    }

    return res.json(result);
  }

  // ==================== TOP SELLING ITEMS ====================

  @Get('sales/top-items')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get top selling items' })
  @ApiQuery({ name: 'top', required: false, description: 'Number of items (default 10)' })
  async getTopSellingItems(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
    @Query('top') top?: number,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getTopSellingItems(effectiveStoreId, dto, top || 10);
  }

  // ==================== SALES BY PAYMENT METHOD ====================

  @Get('sales/by-payment-method')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get sales breakdown by payment method' })
  async getSalesByPaymentMethod(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getSalesByPaymentMethod(effectiveStoreId, dto);
  }

  // ==================== SALES BY HOUR ====================

  @Get('sales/by-hour')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get hourly sales breakdown' })
  async getSalesByHour(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getSalesByHour(effectiveStoreId, dto);
  }

  // ==================== SALES TREND ====================

  @Get('sales/trend')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get daily sales trend' })
  async getSalesTrend(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getSalesTrend(effectiveStoreId, dto);
  }

  // ==================== TRANSACTIONS ====================

  @Get('transactions')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get transaction history' })
  async getTransactions(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getTransactions(effectiveStoreId, dto);
  }

  @Get('transactions/export')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Export transactions to CSV' })
  async exportTransactions(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ExportQueryDto,
    @Res() res: Response,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');

    const result = await this.reportsService.getTransactions(effectiveStoreId, { ...dto, limit: 10000 });

    if (dto.format === ExportFormat.CSV) {
      const csv = this.reportsService.exportToCsv(result.data, [
        { key: 'orderNumber', header: 'Order #' },
        { key: 'invoiceNumber', header: 'Invoice #' },
        { key: 'createdAt', header: 'Date/Time' },
        { key: 'orderType', header: 'Order Type' },
        { key: 'status', header: 'Status' },
        { key: 'customerName', header: 'Customer' },
        { key: 'itemCount', header: 'Items' },
        { key: 'subtotal', header: 'Subtotal' },
        { key: 'discountTotal', header: 'Discount' },
        { key: 'taxTotal', header: 'Tax' },
        { key: 'grandTotal', header: 'Total' },
        { key: 'paymentMethod', header: 'Payment Method' },
        { key: 'branchName', header: 'Branch' },
        { key: 'deviceName', header: 'Device' },
      ]);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=transactions-${dto.startDate || 'all'}.csv`);
      return res.send(csv);
    }

    return res.json(result);
  }

  // ==================== VOIDS ====================

  @Get('voids')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get voided transactions' })
  async getVoidedTransactions(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getVoidedTransactions(effectiveStoreId, dto);
  }

  // ==================== DISCOUNTS ====================

  @Get('discounts')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get discount report' })
  async getDiscountReport(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getDiscountReport(effectiveStoreId, dto);
  }

  // ==================== REFUNDS ====================

  @Get('refunds')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get refund report' })
  async getRefundReport(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getRefundReport(effectiveStoreId, dto);
  }

  // ==================== SHIFTS ====================

  @Get('shifts')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get shift history' })
  async getShiftHistory(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getShiftHistory(effectiveStoreId, dto);
  }

  // ==================== Z-READINGS ====================

  @Get('z-readings')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get Z-Reading history' })
  async getZReadingHistory(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ReportQueryDto,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');
    return this.reportsService.getZReadingHistory(effectiveStoreId, dto);
  }

  @Get('z-readings/export')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Export Z-Readings to CSV' })
  async exportZReadings(
    @CurrentUser() user: CurrentUserData,
    @Query() dto: ExportQueryDto,
    @Res() res: Response,
  ) {
    const effectiveStoreId = user?.storeId || dto.storeId;
    if (!effectiveStoreId) throw new BadRequestException('Store ID is required');

    const result = await this.reportsService.getZReadingHistory(effectiveStoreId, { ...dto, limit: 1000 });

    if (dto.format === ExportFormat.CSV) {
      const csv = this.reportsService.exportToCsv(result.data, [
        { key: 'zCounterNo', header: 'Z Counter' },
        { key: 'readingDate', header: 'Date' },
        { key: 'branchName', header: 'Branch' },
        { key: 'deviceName', header: 'Device' },
        { key: 'beginningInvoice', header: 'Beginning Invoice' },
        { key: 'endingInvoice', header: 'Ending Invoice' },
        { key: 'transactionCount', header: 'Transactions' },
        { key: 'grossSales', header: 'Gross Sales' },
        { key: 'totalDiscounts', header: 'Discounts' },
        { key: 'totalRefunds', header: 'Refunds' },
        { key: 'totalVoids', header: 'Voids' },
        { key: 'netSales', header: 'Net Sales' },
        { key: 'vatableSales', header: 'VATable Sales' },
        { key: 'vatAmount', header: 'VAT Amount' },
        { key: 'vatExemptSales', header: 'VAT Exempt' },
        { key: 'zeroRatedSales', header: 'Zero Rated' },
        { key: 'openingGrandTotal', header: 'Opening GT' },
        { key: 'closingGrandTotal', header: 'Closing GT' },
      ]);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=z-readings-${dto.startDate || 'all'}.csv`);
      return res.send(csv);
    }

    return res.json(result);
  }

  // ==================== Z-READING SYNC (POS Device) ====================

  @Post('z-readings/sync')
  @PosDevice()
  @UseGuards(PosDeviceGuard)
  @ApiOperation({ summary: 'Sync Z-Reading from POS device' })
  async syncZReading(
    @CurrentPosDevice() device: { id: string; deviceIdentifier: string; branchId: string; storeId: string },
    @Body() dto: SyncZReadingDto,
  ) {
    return this.reportsService.syncZReading(device.id, dto);
  }
}

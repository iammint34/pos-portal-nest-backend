import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  ReportQueryDto,
  SalesSummaryDto,
  SalesByBranchDto,
  SalesByDeviceDto,
  SalesByCategoryDto,
  SalesByItemDto,
  SalesByPaymentMethodDto,
  SalesByHourDto,
  SalesTrendDto,
  TransactionDto,
  VoidedTransactionDto,
  RefundReportDto,
  DiscountReportDto,
  ShiftReportDto,
  ZReadingReportDto,
  TopSellingItemDto,
  DashboardStatsDto,
  SyncZReadingDto,
  StaffSalesDto,
  StaffPerformanceDto,
} from './dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get date range for queries
   */
  private getDateRange(dto: ReportQueryDto): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (dto.startDate) {
      start = new Date(dto.startDate);
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
    }

    if (dto.endDate) {
      end = new Date(dto.endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }

  /**
   * Build common where clause for store filtering
   */
  private buildStoreFilter(storeId: string, dto: ReportQueryDto) {
    return {
      storeId,
      ...(dto.branchId && { branchId: dto.branchId }),
      ...(dto.posDeviceId && { posDeviceId: dto.posDeviceId }),
    };
  }

  /**
   * Dashboard stats for quick overview
   */
  async getDashboardStats(storeId: string): Promise<DashboardStatsDto> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(todayStart);
    monthStart.setDate(1);

    // Today's stats
    const todayOrders = await this.prisma.order.findMany({
      where: {
        storeId,
        status: OrderStatus.COMPLETED,
        posCreatedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    const todaySales = todayOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const todayCount = todayOrders.length;
    const todayAvgOrder = todayCount > 0 ? todaySales / todayCount : 0;

    // Yesterday's stats
    const yesterdayOrders = await this.prisma.order.findMany({
      where: {
        storeId,
        status: OrderStatus.COMPLETED,
        posCreatedAt: { gte: yesterdayStart, lte: yesterdayEnd },
      },
    });

    const yesterdaySales = yesterdayOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const yesterdayCount = yesterdayOrders.length;

    // Week's stats
    const weekOrders = await this.prisma.order.findMany({
      where: {
        storeId,
        status: OrderStatus.COMPLETED,
        posCreatedAt: { gte: weekStart, lte: todayEnd },
      },
    });

    const weekSales = weekOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);

    // Month's stats
    const monthOrders = await this.prisma.order.findMany({
      where: {
        storeId,
        status: OrderStatus.COMPLETED,
        posCreatedAt: { gte: monthStart, lte: todayEnd },
      },
    });

    const monthSales = monthOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);

    // Growth calculations
    const salesGrowth = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0;
    const ordersGrowth = yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 : 0;

    return {
      todaySales,
      todayOrders: todayCount,
      todayAvgOrder,
      yesterdaySales,
      yesterdayOrders: yesterdayCount,
      weekSales,
      weekOrders: weekOrders.length,
      monthSales,
      monthOrders: monthOrders.length,
      salesGrowth,
      ordersGrowth,
    };
  }

  /**
   * Get sales summary
   */
  async getSalesSummary(storeId: string, dto: ReportQueryDto): Promise<SalesSummaryDto> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);

    const orders = await this.prisma.order.findMany({
      where: {
        ...storeFilter,
        posCreatedAt: { gte: start, lte: end },
      },
      include: {
        payments: true,
      },
    });

    const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED);
    const voidedOrders = orders.filter(o => o.status === OrderStatus.VOIDED);

    const grossSales = completedOrders.reduce((sum, o) => sum + Number(o.subtotal), 0);
    const totalDiscounts = completedOrders.reduce((sum, o) => sum + Number(o.discountTotal), 0);
    const netSales = completedOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const totalTax = completedOrders.reduce((sum, o) => sum + Number(o.taxTotal), 0);

    const vatableSales = completedOrders.reduce((sum, o) => sum + Number(o.vatableSales || 0), 0);
    const vatAmount = completedOrders.reduce((sum, o) => sum + Number(o.vatAmount || 0), 0);
    const vatExemptSales = completedOrders.reduce((sum, o) => sum + Number(o.vatExemptSales || 0), 0);
    const zeroRatedSales = completedOrders.reduce((sum, o) => sum + Number(o.zeroRatedSales || 0), 0);

    const allPayments = completedOrders.flatMap(o => o.payments).filter(p => p.status === PaymentStatus.COMPLETED);
    const cashSales = allPayments
      .filter(p => p.paymentMethod === PaymentMethod.CASH)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const cardSales = allPayments
      .filter(p => p.paymentMethod === PaymentMethod.CREDIT_CARD || p.paymentMethod === PaymentMethod.DEBIT_CARD)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const otherSales = allPayments
      .filter(p => p.paymentMethod !== PaymentMethod.CASH && p.paymentMethod !== PaymentMethod.CREDIT_CARD && p.paymentMethod !== PaymentMethod.DEBIT_CARD)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const refunds = await this.prisma.refund.findMany({
      where: {
        order: { ...storeFilter },
        processedAt: { gte: start, lte: end },
      },
    });
    const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.amount), 0);

    return {
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      voidedOrders: voidedOrders.length,
      grossSales,
      totalDiscounts,
      totalRefunds,
      netSales,
      totalTax,
      vatableSales,
      vatAmount,
      vatExemptSales,
      zeroRatedSales,
      cashSales,
      cardSales,
      otherSales,
      averageOrderValue: completedOrders.length > 0 ? netSales / completedOrders.length : 0,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    };
  }

  /**
   * Get sales by branch
   */
  async getSalesByBranch(storeId: string, dto: ReportQueryDto): Promise<SalesByBranchDto[]> {
    const { start, end } = this.getDateRange(dto);

    const branches = await this.prisma.branch.findMany({
      where: { storeId, deletedAt: null },
      select: { id: true, name: true },
    });

    const orders = await this.prisma.order.findMany({
      where: {
        storeId,
        status: OrderStatus.COMPLETED,
        posCreatedAt: { gte: start, lte: end },
      },
    });

    const refunds = await this.prisma.refund.findMany({
      where: {
        order: { storeId },
        processedAt: { gte: start, lte: end },
      },
      include: {
        order: { select: { branchId: true } },
      },
    });

    // Group by branch
    const branchMap = new Map<string, {
      name: string;
      orderCount: number;
      gross: number;
      discounts: number;
      refunds: number;
    }>();

    for (const branch of branches) {
      branchMap.set(branch.id, {
        name: branch.name,
        orderCount: 0,
        gross: 0,
        discounts: 0,
        refunds: 0,
      });
    }

    for (const order of orders) {
      const branch = branchMap.get(order.branchId);
      if (branch) {
        branch.orderCount++;
        branch.gross += Number(order.subtotal);
        branch.discounts += Number(order.discountTotal);
      }
    }

    for (const refund of refunds) {
      const branch = branchMap.get(refund.order.branchId);
      if (branch) {
        branch.refunds += Number(refund.amount);
      }
    }

    const totalNet = Array.from(branchMap.values()).reduce((sum, b) => sum + (b.gross - b.discounts - b.refunds), 0);

    return Array.from(branchMap.entries())
      .map(([branchId, data]) => {
        const netSales = data.gross - data.discounts - data.refunds;
        return {
          branchId,
          branchName: data.name,
          orderCount: data.orderCount,
          grossSales: data.gross,
          discounts: data.discounts,
          refunds: data.refunds,
          netSales,
          percentage: totalNet > 0 ? (netSales / totalNet) * 100 : 0,
        };
      })
      .sort((a, b) => b.netSales - a.netSales);
  }

  /**
   * Get sales by device
   */
  async getSalesByDevice(storeId: string, dto: ReportQueryDto): Promise<SalesByDeviceDto[]> {
    const { start, end } = this.getDateRange(dto);

    const devices = await this.prisma.posDevice.findMany({
      where: {
        branch: { storeId },
        deletedAt: null,
      },
      include: {
        branch: { select: { name: true } },
      },
    });

    const orders = await this.prisma.order.findMany({
      where: {
        storeId,
        ...(dto.branchId && { branchId: dto.branchId }),
        status: OrderStatus.COMPLETED,
        posCreatedAt: { gte: start, lte: end },
      },
    });

    // Group by device
    const deviceMap = new Map<string, {
      name: string;
      branchName: string;
      orderCount: number;
      gross: number;
      discounts: number;
    }>();

    for (const device of devices) {
      deviceMap.set(device.id, {
        name: device.name || device.deviceIdentifier || 'Unknown',
        branchName: device.branch.name,
        orderCount: 0,
        gross: 0,
        discounts: 0,
      });
    }

    for (const order of orders) {
      const device = deviceMap.get(order.posDeviceId);
      if (device) {
        device.orderCount++;
        device.gross += Number(order.subtotal);
        device.discounts += Number(order.discountTotal);
      }
    }

    const totalNet = Array.from(deviceMap.values()).reduce((sum, d) => sum + (d.gross - d.discounts), 0);

    return Array.from(deviceMap.entries())
      .map(([deviceId, data]) => {
        const netSales = data.gross - data.discounts;
        return {
          posDeviceId: deviceId,
          deviceName: data.name,
          branchName: data.branchName,
          orderCount: data.orderCount,
          grossSales: data.gross,
          discounts: data.discounts,
          netSales,
          percentage: totalNet > 0 ? (netSales / totalNet) * 100 : 0,
        };
      })
      .filter(d => d.orderCount > 0)
      .sort((a, b) => b.netSales - a.netSales);
  }

  /**
   * Get sales by category
   */
  async getSalesByCategory(storeId: string, dto: ReportQueryDto): Promise<SalesByCategoryDto[]> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        isVoided: false,
        order: {
          ...storeFilter,
          status: OrderStatus.COMPLETED,
          posCreatedAt: { gte: start, lte: end },
        },
      },
      include: {
        item: {
          include: {
            category: true,
          },
        },
      },
    });

    const categoryMap = new Map<string, {
      categoryName: string;
      items: Set<string>;
      quantity: number;
      gross: number;
      discounts: number;
    }>();

    for (const oi of orderItems) {
      const categoryId = oi.item?.category?.id || 'uncategorized';
      const categoryName = oi.item?.category?.name || 'Uncategorized';

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          categoryName,
          items: new Set(),
          quantity: 0,
          gross: 0,
          discounts: 0,
        });
      }

      const cat = categoryMap.get(categoryId)!;
      if (oi.itemId) cat.items.add(oi.itemId);
      cat.quantity += oi.quantity;
      cat.gross += Number(oi.unitPrice) * oi.quantity;
      cat.discounts += Number(oi.discountAmount);
    }

    const totalNet = Array.from(categoryMap.values()).reduce((sum, c) => sum + (c.gross - c.discounts), 0);

    return Array.from(categoryMap.entries())
      .map(([categoryId, data]) => {
        const netSales = data.gross - data.discounts;
        return {
          categoryId,
          categoryName: data.categoryName,
          itemCount: data.items.size,
          quantitySold: data.quantity,
          grossSales: data.gross,
          discounts: data.discounts,
          netSales,
          percentage: totalNet > 0 ? (netSales / totalNet) * 100 : 0,
        };
      })
      .sort((a, b) => b.netSales - a.netSales);
  }

  /**
   * Get sales by item
   */
  async getSalesByItem(storeId: string, dto: ReportQueryDto): Promise<{ data: SalesByItemDto[]; meta: any }> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);
    const page = dto.page || 1;
    const limit = dto.limit || 50;

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        isVoided: false,
        order: {
          ...storeFilter,
          status: OrderStatus.COMPLETED,
          posCreatedAt: { gte: start, lte: end },
        },
      },
      include: {
        item: {
          include: {
            category: true,
          },
        },
      },
    });

    const itemMap = new Map<string, {
      itemName: string;
      itemSku?: string;
      categoryName?: string;
      quantity: number;
      gross: number;
      discounts: number;
    }>();

    for (const oi of orderItems) {
      const itemId = oi.itemId || oi.id;
      const itemName = oi.itemName;

      if (!itemMap.has(itemId)) {
        itemMap.set(itemId, {
          itemName,
          itemSku: oi.item?.sku || oi.itemSku || undefined,
          categoryName: oi.item?.category?.name || undefined,
          quantity: 0,
          gross: 0,
          discounts: 0,
        });
      }

      const item = itemMap.get(itemId)!;
      item.quantity += oi.quantity;
      item.gross += Number(oi.unitPrice) * oi.quantity;
      item.discounts += Number(oi.discountAmount);
    }

    const allItems = Array.from(itemMap.entries())
      .map(([itemId, data]) => {
        const netSales = data.gross - data.discounts;
        return {
          itemId,
          itemName: data.itemName,
          itemSku: data.itemSku,
          categoryName: data.categoryName,
          quantitySold: data.quantity,
          grossSales: data.gross,
          discounts: data.discounts,
          netSales,
          averagePrice: data.quantity > 0 ? netSales / data.quantity : 0,
        };
      })
      .sort((a, b) => b.quantitySold - a.quantitySold);

    const total = allItems.length;
    const paginatedData = allItems.slice((page - 1) * limit, page * limit);

    return {
      data: paginatedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get top selling items
   */
  async getTopSellingItems(storeId: string, dto: ReportQueryDto, topN: number = 10): Promise<TopSellingItemDto[]> {
    const result = await this.getSalesByItem(storeId, { ...dto, limit: topN, page: 1 });
    return result.data.map((item, index) => ({
      ...item,
      revenue: item.netSales,
      rank: index + 1,
    }));
  }

  /**
   * Get sales by payment method
   */
  async getSalesByPaymentMethod(storeId: string, dto: ReportQueryDto): Promise<SalesByPaymentMethodDto[]> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);

    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.COMPLETED,
        order: {
          ...storeFilter,
          status: OrderStatus.COMPLETED,
          posCreatedAt: { gte: start, lte: end },
        },
      },
    });

    const methodMap = new Map<string, { count: number; amount: number; tips: number }>();

    for (const p of payments) {
      const method = p.paymentMethod;
      if (!methodMap.has(method)) {
        methodMap.set(method, { count: 0, amount: 0, tips: 0 });
      }
      const m = methodMap.get(method)!;
      m.count++;
      m.amount += Number(p.amount);
      m.tips += Number(p.tipAmount);
    }

    const totalAmount = Array.from(methodMap.values()).reduce((sum, m) => sum + m.amount, 0);

    return Array.from(methodMap.entries())
      .map(([method, data]) => ({
        paymentMethod: method,
        transactionCount: data.count,
        totalAmount: data.amount,
        tipAmount: data.tips,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }

  /**
   * Get sales by hour
   */
  async getSalesByHour(storeId: string, dto: ReportQueryDto): Promise<SalesByHourDto[]> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);

    const orders = await this.prisma.order.findMany({
      where: {
        ...storeFilter,
        status: OrderStatus.COMPLETED,
        posCreatedAt: { gte: start, lte: end },
      },
      include: {
        orderItems: { where: { isVoided: false } },
      },
    });

    const hourMap = new Map<number, { count: number; sales: number; items: number }>();

    for (let i = 0; i < 24; i++) {
      hourMap.set(i, { count: 0, sales: 0, items: 0 });
    }

    for (const order of orders) {
      const hour = new Date(order.posCreatedAt).getHours();
      const h = hourMap.get(hour)!;
      h.count++;
      h.sales += Number(order.grandTotal);
      h.items += order.orderItems.reduce((sum, oi) => sum + oi.quantity, 0);
    }

    const formatHour = (h: number): string => {
      const startHour = h % 12 || 12;
      const endHour = (h + 1) % 12 || 12;
      const startPeriod = h < 12 ? 'AM' : 'PM';
      const endPeriod = (h + 1) < 12 || (h + 1) === 24 ? 'AM' : 'PM';
      return `${startHour}:00 ${startPeriod} - ${endHour}:00 ${endPeriod}`;
    };

    return Array.from(hourMap.entries())
      .map(([hour, data]) => ({
        hour,
        hourLabel: formatHour(hour),
        orderCount: data.count,
        totalSales: data.sales,
        itemsSold: data.items,
      }))
      .sort((a, b) => a.hour - b.hour);
  }

  /**
   * Get sales trend (daily breakdown)
   */
  async getSalesTrend(storeId: string, dto: ReportQueryDto): Promise<SalesTrendDto[]> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);

    const orders = await this.prisma.order.findMany({
      where: {
        ...storeFilter,
        status: OrderStatus.COMPLETED,
        posCreatedAt: { gte: start, lte: end },
      },
    });

    // Group by date
    const dateMap = new Map<string, { count: number; gross: number; net: number }>();

    for (const order of orders) {
      const dateKey = new Date(order.posCreatedAt).toISOString().split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { count: 0, gross: 0, net: 0 });
      }
      const d = dateMap.get(dateKey)!;
      d.count++;
      d.gross += Number(order.subtotal);
      d.net += Number(order.grandTotal);
    }

    return Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        orderCount: data.count,
        grossSales: data.gross,
        netSales: data.net,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get transaction history
   */
  async getTransactions(storeId: string, dto: ReportQueryDto): Promise<{ data: TransactionDto[]; meta: any }> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);
    const page = dto.page || 1;
    const limit = dto.limit || 50;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          ...storeFilter,
          posCreatedAt: { gte: start, lte: end },
        },
        include: {
          orderItems: { where: { isVoided: false } },
          payments: { where: { status: PaymentStatus.COMPLETED } },
          posDevice: {
            select: { name: true, deviceIdentifier: true, branch: { select: { name: true } } },
          },
        },
        orderBy: { posCreatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({
        where: {
          ...storeFilter,
          posCreatedAt: { gte: start, lte: end },
        },
      }),
    ]);

    return {
      data: orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        invoiceNumber: o.invoiceNumber || undefined,
        orderType: o.orderType,
        status: o.status,
        customerName: o.customerName || undefined,
        subtotal: Number(o.subtotal),
        discountTotal: Number(o.discountTotal),
        taxTotal: Number(o.taxTotal),
        grandTotal: Number(o.grandTotal),
        itemCount: o.orderItems.reduce((sum, oi) => sum + oi.quantity, 0),
        paymentMethod: o.payments.length > 0 ? o.payments[0].paymentMethod : undefined,
        branchName: o.posDevice.branch.name,
        deviceName: o.posDevice.name || o.posDevice.deviceIdentifier || 'Unknown',
        createdAt: o.posCreatedAt.toISOString(),
        closedAt: o.posClosedAt?.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get voided transactions
   */
  async getVoidedTransactions(storeId: string, dto: ReportQueryDto): Promise<{ data: VoidedTransactionDto[]; meta: any }> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);
    const page = dto.page || 1;
    const limit = dto.limit || 50;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          ...storeFilter,
          status: OrderStatus.VOIDED,
          posCreatedAt: { gte: start, lte: end },
        },
        include: {
          posDevice: {
            select: { name: true, deviceIdentifier: true, branch: { select: { name: true } } },
          },
        },
        orderBy: { posCreatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({
        where: {
          ...storeFilter,
          status: OrderStatus.VOIDED,
          posCreatedAt: { gte: start, lte: end },
        },
      }),
    ]);

    return {
      data: orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        invoiceNumber: o.invoiceNumber || undefined,
        originalTotal: Number(o.grandTotal),
        voidReason: o.notes || undefined,
        branchName: o.posDevice.branch.name,
        deviceName: o.posDevice.name || o.posDevice.deviceIdentifier || 'Unknown',
        voidedAt: o.posClosedAt?.toISOString() || o.posCreatedAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get discount report
   */
  async getDiscountReport(storeId: string, dto: ReportQueryDto): Promise<DiscountReportDto[]> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);

    const discounts = await this.prisma.orderDiscount.findMany({
      where: {
        order: {
          ...storeFilter,
          status: OrderStatus.COMPLETED,
          posCreatedAt: { gte: start, lte: end },
        },
      },
    });

    const discountMap = new Map<string, {
      name: string;
      type: string;
      scope: string;
      count: number;
      total: number;
      orders: Set<string>;
    }>();

    for (const d of discounts) {
      const key = d.discountName;
      if (!discountMap.has(key)) {
        discountMap.set(key, {
          name: d.discountName,
          type: d.discountType,
          scope: d.discountScope,
          count: 0,
          total: 0,
          orders: new Set(),
        });
      }
      const disc = discountMap.get(key)!;
      disc.count++;
      disc.total += Number(d.discountAmount);
      disc.orders.add(d.orderId);
    }

    return Array.from(discountMap.values())
      .map(d => ({
        discountName: d.name,
        discountType: d.type,
        discountScope: d.scope,
        timesApplied: d.count,
        totalDiscountAmount: d.total,
        ordersAffected: d.orders.size,
      }))
      .sort((a, b) => b.totalDiscountAmount - a.totalDiscountAmount);
  }

  /**
   * Get refund report
   */
  async getRefundReport(storeId: string, dto: ReportQueryDto): Promise<{ data: RefundReportDto[]; meta: any }> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);
    const page = dto.page || 1;
    const limit = dto.limit || 50;

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where: {
          order: storeFilter,
          processedAt: { gte: start, lte: end },
        },
        include: {
          payment: true,
          order: {
            select: {
              orderNumber: true,
              posDevice: {
                select: { branch: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { processedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.refund.count({
        where: {
          order: storeFilter,
          processedAt: { gte: start, lte: end },
        },
      }),
    ]);

    return {
      data: refunds.map(r => ({
        id: r.id,
        orderId: r.orderId,
        orderNumber: r.order.orderNumber,
        paymentMethod: r.payment?.paymentMethod || 'Unknown',
        refundMethod: r.refundMethod,
        amount: Number(r.amount),
        reason: r.reason || undefined,
        processedBy: r.processedBy || undefined,
        branchName: r.order.posDevice.branch.name,
        processedAt: r.processedAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get shift history
   */
  async getShiftHistory(storeId: string, dto: ReportQueryDto): Promise<{ data: ShiftReportDto[]; meta: any }> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);
    const page = dto.page || 1;
    const limit = dto.limit || 20;

    const [shifts, total] = await Promise.all([
      this.prisma.shift.findMany({
        where: {
          ...storeFilter,
          openedAt: { gte: start, lte: end },
        },
        include: {
          operator: { select: { firstName: true, lastName: true } },
          posDevice: {
            select: { name: true, deviceIdentifier: true, branch: { select: { name: true } } },
          },
          _count: { select: { orders: true } },
        },
        orderBy: { openedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.shift.count({
        where: {
          ...storeFilter,
          openedAt: { gte: start, lte: end },
        },
      }),
    ]);

    // Get total sales for each shift
    const shiftSales = await Promise.all(
      shifts.map(async s => {
        const orders = await this.prisma.order.findMany({
          where: {
            shiftId: s.id,
            status: OrderStatus.COMPLETED,
          },
          select: { grandTotal: true },
        });
        return orders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
      })
    );

    return {
      data: shifts.map((s, i) => {
        let duration: string | undefined;
        if (s.closedAt) {
          const durationMs = new Date(s.closedAt).getTime() - new Date(s.openedAt).getTime();
          const hours = Math.floor(durationMs / (1000 * 60 * 60));
          const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
          duration = `${hours}h ${minutes}m`;
        }

        return {
          id: s.id,
          operatorName: s.operator ? `${s.operator.firstName} ${s.operator.lastName}` : 'Unknown',
          branchName: s.posDevice.branch.name,
          deviceName: s.posDevice.name || s.posDevice.deviceIdentifier || 'Unknown',
          status: s.status,
          openedAt: s.openedAt.toISOString(),
          closedAt: s.closedAt?.toISOString(),
          duration,
          openingCash: Number(s.openingCash),
          closingCash: s.closingCash ? Number(s.closingCash) : undefined,
          expectedCash: Number(s.expectedCash || 0),
          variance: s.variance ? Number(s.variance) : undefined,
          orderCount: s._count.orders,
          totalSales: shiftSales[i],
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get Z-Reading history
   */
  async getZReadingHistory(storeId: string, dto: ReportQueryDto): Promise<{ data: ZReadingReportDto[]; meta: any }> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);
    const page = dto.page || 1;
    const limit = dto.limit || 20;

    const [zReadings, total] = await Promise.all([
      this.prisma.zReading.findMany({
        where: {
          ...storeFilter,
          closedAt: { gte: start, lte: end },
        },
        include: {
          posDevice: {
            select: { name: true, deviceIdentifier: true, branch: { select: { name: true } } },
          },
        },
        orderBy: { closedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.zReading.count({
        where: {
          ...storeFilter,
          closedAt: { gte: start, lte: end },
        },
      }),
    ]);

    return {
      data: zReadings.map(z => ({
        id: z.id,
        zCounterNo: z.zCounterNo,
        branchName: z.posDevice.branch.name,
        deviceName: z.posDevice.name || z.posDevice.deviceIdentifier || 'Unknown',
        readingDate: z.closedAt.toISOString(),
        beginningInvoice: z.beginningInvoiceNo,
        endingInvoice: z.endingInvoiceNo,
        openingGrandTotal: Number(z.beginningGrandTotal),
        closingGrandTotal: Number(z.endingGrandTotal),
        grossSales: Number(z.grossSales),
        netSales: Number(z.netSales),
        vatableSales: Number(z.vatableSales),
        vatAmount: Number(z.vatAmount),
        vatExemptSales: Number(z.vatExemptSales),
        zeroRatedSales: Number(z.zeroRatedSales),
        totalDiscounts: Number(z.discountTotal),
        totalRefunds: Number(z.refundTotal),
        totalVoids: Number(z.voidTotal),
        transactionCount: z.transactionCount,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Sync Z-Reading from POS device
   */
  async syncZReading(posDeviceId: string, dto: SyncZReadingDto) {
    // Get device info for storeId and branchId
    const device = await this.prisma.posDevice.findUnique({
      where: { id: posDeviceId },
      include: { branch: { select: { id: true, storeId: true } } },
    });

    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    const branchId = device.branchId;
    const storeId = device.branch.storeId;

    // Upsert Z-Reading using idempotency key (posDeviceId + posZReadingId)
    const zReading = await this.prisma.zReading.upsert({
      where: {
        posDeviceId_posZReadingId: {
          posDeviceId,
          posZReadingId: dto.posZReadingId,
        },
      },
      create: {
        posDeviceId,
        posZReadingId: dto.posZReadingId,
        branchId,
        storeId,
        zCounterNo: dto.zCounterNo,
        beginningInvoiceNo: dto.beginningInvoiceNo,
        endingInvoiceNo: dto.endingInvoiceNo,
        beginningGrandTotal: dto.beginningGrandTotal,
        endingGrandTotal: dto.endingGrandTotal,
        grossSales: dto.grossSales,
        netSales: dto.netSales,
        vatableSales: dto.vatableSales,
        vatAmount: dto.vatAmount,
        vatExemptSales: dto.vatExemptSales,
        zeroRatedSales: dto.zeroRatedSales,
        discountTotal: dto.discountTotal,
        refundTotal: dto.refundTotal,
        voidTotal: dto.voidTotal,
        transactionCount: dto.transactionCount,
        voidCount: dto.voidCount,
        refundCount: dto.refundCount,
        closedBy: dto.closedBy,
        closedAt: new Date(dto.closedAt),
        syncedAt: new Date(),
      },
      update: {
        zCounterNo: dto.zCounterNo,
        beginningInvoiceNo: dto.beginningInvoiceNo,
        endingInvoiceNo: dto.endingInvoiceNo,
        beginningGrandTotal: dto.beginningGrandTotal,
        endingGrandTotal: dto.endingGrandTotal,
        grossSales: dto.grossSales,
        netSales: dto.netSales,
        vatableSales: dto.vatableSales,
        vatAmount: dto.vatAmount,
        vatExemptSales: dto.vatExemptSales,
        zeroRatedSales: dto.zeroRatedSales,
        discountTotal: dto.discountTotal,
        refundTotal: dto.refundTotal,
        voidTotal: dto.voidTotal,
        transactionCount: dto.transactionCount,
        voidCount: dto.voidCount,
        refundCount: dto.refundCount,
        closedBy: dto.closedBy,
        closedAt: new Date(dto.closedAt),
        syncedAt: new Date(),
      },
    });

    return {
      success: true,
      posZReadingId: dto.posZReadingId,
      portalZReadingId: zReading.id,
    };
  }

  /**
   * Get Z-Readings with store/branch info for export
   */
  async getZReadingsForExport(storeId: string, dto: ReportQueryDto) {
    const { start, end } = this.getDateRange(dto);

    // Build where clause
    const whereClause: any = {
      storeId,
      closedAt: { gte: start, lte: end },
    };
    if (dto.branchId) {
      whereClause.branchId = dto.branchId;
    }
    if (dto.posDeviceId) {
      whereClause.posDeviceId = dto.posDeviceId;
    }

    const [zReadings, store] = await Promise.all([
      this.prisma.zReading.findMany({
        where: whereClause,
        include: {
          posDevice: {
            select: {
              name: true,
              deviceIdentifier: true,
              min: true,
              serialNumber: true,
              branch: {
                select: {
                  name: true,
                  address: true,
                  ptuNo: true,
                  ptuDateIssued: true,
                  ptuValidUntil: true,
                  accreditationNo: true,
                },
              },
            },
          },
        },
        orderBy: { closedAt: 'desc' },
      }),
      this.prisma.store.findUnique({
        where: { id: storeId },
        select: {
          name: true,
          registeredName: true,
          registeredAddress: true,
          vatTin: true,
          isVatRegistered: true,
        },
      }),
    ]);

    // Get branch info if branchId is specified
    let branchInfo = null;
    if (dto.branchId) {
      branchInfo = await this.prisma.branch.findUnique({
        where: { id: dto.branchId },
        select: {
          name: true,
          address: true,
          ptuNo: true,
          ptuDateIssued: true,
          ptuValidUntil: true,
          accreditationNo: true,
        },
      });
    }

    // Get user names for closedBy IDs
    const userIds = [...new Set(zReadings.map(z => z.closedBy).filter(id => id && id !== 'system'))];
    const users = userIds.length > 0 ? await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    }) : [];
    const userMap = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    // Attach user names to z-readings
    const zReadingsWithUsers = zReadings.map(z => {
      if (z.closedBy === 'system') {
        return { ...z, closedByName: 'SYSTEM' };
      }
      const userName = userMap.get(z.closedBy);
      const shortId = z.closedBy.substring(0, 8).toUpperCase();
      return {
        ...z,
        closedByName: userName ? `${userName.toUpperCase()} (${shortId})` : z.closedBy,
      };
    });

    return {
      data: zReadingsWithUsers,
      storeInfo: store,
      branchInfo,
    };
  }

  /**
   * Generate BIR-compliant Z-Reading report text
   */
  generateZReadingReport(
    zReadings: any[],
    storeInfo: any,
    branchInfo: any,
  ): string {
    if (!zReadings || zReadings.length === 0) {
      return 'No Z-Readings found for the selected period.';
    }

    const formatMoney = (amount: number | null | undefined) => {
      const num = Number(amount) || 0;
      return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const formatDate = (date: Date | string | null) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    };
    const formatTime = (date: Date | string | null) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    const padNum = (num: string, len: number) => num.padStart(len);

    let report = '';

    for (const z of zReadings) {
      const device = z.posDevice || {};
      const branch = device?.branch || branchInfo || {};

      report += '================================================================\n';
      report += '                      Z - R E A D I N G\n';
      report += '              ( End of Day Sales Summary Report )\n';
      report += '================================================================\n\n';

      report += '----------------------------------------------------------------\n';
      report += '                    BUSINESS INFORMATION\n';
      report += '----------------------------------------------------------------\n';
      report += `Business Name      : ${storeInfo?.registeredName || storeInfo?.name || 'N/A'}\n`;
      report += `Address            : ${storeInfo?.registeredAddress || branch?.address || 'N/A'}\n`;
      report += `TIN                : ${storeInfo?.vatTin || 'N/A'}\n`;
      report += `Accreditation No.  : ${branch?.accreditationNo || 'N/A'}\n`;
      report += `PTU No.            : ${branch?.ptuNo || 'N/A'}\n`;
      report += `MIN                : ${device?.min || 'N/A'}\n`;
      report += `Serial No.         : ${device?.serialNumber || 'N/A'}\n\n`;

      report += '================================================================\n';
      report += '                    REPORT INFORMATION\n';
      report += '----------------------------------------------------------------\n';
      report += `Z-Reading No.      : ${String(z.zCounterNo).padStart(9, '0')}\n`;
      report += `Report Date        : ${formatDate(z.closedAt)}\n`;
      report += `Report Time        : ${formatTime(z.closedAt)}\n`;
      report += `Cashier/User       : ${z.closedByName || z.closedBy || 'SYSTEM'}\n`;
      report += `Branch             : ${branch?.name || 'N/A'}\n`;
      report += `Device             : ${device?.name || device?.deviceIdentifier || 'N/A'}\n`;
      report += '================================================================\n\n';

      report += '----------------------------------------------------------------\n';
      report += '                  TRANSACTION SUMMARY\n';
      report += '----------------------------------------------------------------\n';
      report += `Beginning OR No.   : ${z.beginningInvoiceNo}\n`;
      report += `Ending OR No.      : ${z.endingInvoiceNo}\n`;
      report += `Total Transactions : ${padNum(String(z.transactionCount), 10)}\n`;
      report += `Void Count         : ${padNum(String(z.voidCount), 10)}\n`;
      report += `Refund Count       : ${padNum(String(z.refundCount), 10)}\n\n`;

      report += '================================================================\n';
      report += '                    SALES BREAKDOWN\n';
      report += '================================================================\n';
      report += '                                                    AMOUNT (PHP)\n';
      report += '----------------------------------------------------------------\n';
      report += `GROSS SALES                                     ${padNum(formatMoney(Number(z.grossSales)), 15)}\n\n`;

      report += `  VATable Sales                                 ${padNum(formatMoney(Number(z.vatableSales)), 15)}\n`;
      report += `  VAT Amount (12%)                              ${padNum(formatMoney(Number(z.vatAmount)), 15)}\n`;
      report += `  VAT-Exempt Sales                              ${padNum(formatMoney(Number(z.vatExemptSales)), 15)}\n`;
      report += `  Zero-Rated Sales                              ${padNum(formatMoney(Number(z.zeroRatedSales)), 15)}\n\n`;

      report += '----------------------------------------------------------------\n';
      report += '                      DEDUCTIONS\n';
      report += '----------------------------------------------------------------\n';
      report += `  Refunds                                       ${padNum(formatMoney(Number(z.refundTotal)), 15)}\n`;
      report += `  Voids                                         ${padNum(formatMoney(Number(z.voidTotal)), 15)}\n`;
      report += `  Discounts                                     ${padNum(formatMoney(Number(z.discountTotal)), 15)}\n`;
      report += '                                                ---------------\n';
      const totalDeductions = Number(z.refundTotal) + Number(z.voidTotal) + Number(z.discountTotal);
      report += `TOTAL DEDUCTIONS                                ${padNum(formatMoney(totalDeductions), 15)}\n\n`;

      report += '================================================================\n';
      report += `NET SALES                                       ${padNum(formatMoney(Number(z.netSales)), 15)}\n`;
      report += '================================================================\n\n';

      report += '----------------------------------------------------------------\n';
      report += '                 ACCUMULATED TOTALS\n';
      report += '              ( Non-Resettable Counters )\n';
      report += '================================================================\n';
      report += `OLD GRAND TOTAL SALES                       ${padNum(formatMoney(Number(z.beginningGrandTotal)), 15)}\n`;
      report += `Today's Net Sales                           ${padNum(formatMoney(Number(z.netSales)), 15)}\n`;
      report += '                                            -------------------\n';
      report += `NEW GRAND TOTAL SALES                       ${padNum(formatMoney(Number(z.endingGrandTotal)), 15)}\n\n`;

      report += `Z-Counter                                             ${padNum(String(z.zCounterNo), 10)}\n\n`;

      report += '================================================================\n\n';
      report += '         THIS SERVES AS YOUR Z-READING REPORT\n';
      report += '        THIS DOCUMENT IS SYSTEM-GENERATED AND\n';
      report += '            DOES NOT REQUIRE A SIGNATURE\n\n';
      report += '       *** END OF Z-READING REPORT ***\n\n';
      report += `Generated: ${formatDate(new Date())} ${formatTime(new Date())}\n\n`;
      report += '================================================================\n';
      report += '     THIS REPORT IS VALID FOR BIR AUDIT PURPOSES\n';
      report += '     RETAIN FOR A MINIMUM OF TEN (10) YEARS\n';
      report += '================================================================\n\n\n';
    }

    return report;
  }

  /**
   * Get sales breakdown by staff member
   */
  async getSalesByStaff(storeId: string, dto: ReportQueryDto): Promise<StaffSalesDto[]> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);

    const orders = await this.prisma.order.findMany({
      where: {
        ...storeFilter,
        status: OrderStatus.COMPLETED,
        posCreatedAt: { gte: start, lte: end },
        operatorId: { not: null },
      },
    });

    // Group by operatorId
    const staffMap = new Map<string, {
      orderCount: number;
      gross: number;
      discounts: number;
    }>();

    for (const order of orders) {
      const opId = order.operatorId!;
      if (!staffMap.has(opId)) {
        staffMap.set(opId, { orderCount: 0, gross: 0, discounts: 0 });
      }
      const staff = staffMap.get(opId)!;
      staff.orderCount++;
      staff.gross += Number(order.subtotal);
      staff.discounts += Number(order.discountTotal);
    }

    // Resolve operator names in batch
    const operatorIds = Array.from(staffMap.keys());
    const users = operatorIds.length > 0 ? await this.prisma.user.findMany({
      where: { id: { in: operatorIds } },
      select: { id: true, firstName: true, lastName: true },
    }) : [];
    const userMap = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    const totalNet = Array.from(staffMap.values()).reduce((sum, s) => sum + (s.gross - s.discounts), 0);

    return Array.from(staffMap.entries())
      .map(([operatorId, data]) => {
        const netSales = data.gross - data.discounts;
        return {
          operatorId,
          operatorName: userMap.get(operatorId) || 'Unknown',
          orderCount: data.orderCount,
          grossSales: data.gross,
          discounts: data.discounts,
          netSales,
          averageOrderValue: data.orderCount > 0 ? netSales / data.orderCount : 0,
          percentage: totalNet > 0 ? (netSales / totalNet) * 100 : 0,
        };
      })
      .sort((a, b) => b.netSales - a.netSales);
  }

  /**
   * Get comprehensive staff performance metrics
   */
  async getStaffPerformance(storeId: string, dto: ReportQueryDto): Promise<StaffPerformanceDto[]> {
    const { start, end } = this.getDateRange(dto);
    const storeFilter = this.buildStoreFilter(storeId, dto);

    // Run queries in parallel
    const [completedOrders, voidedOrders, refunds, discounts, shifts] = await Promise.all([
      // Completed orders by operator
      this.prisma.order.findMany({
        where: {
          ...storeFilter,
          status: OrderStatus.COMPLETED,
          posCreatedAt: { gte: start, lte: end },
          operatorId: { not: null },
        },
      }),
      // Voided orders by operator
      this.prisma.order.findMany({
        where: {
          ...storeFilter,
          status: OrderStatus.VOIDED,
          posCreatedAt: { gte: start, lte: end },
          operatorId: { not: null },
        },
      }),
      // Refunds by processedBy
      this.prisma.refund.findMany({
        where: {
          order: storeFilter,
          processedAt: { gte: start, lte: end },
          processedBy: { not: null },
        },
      }),
      // Discounts by appliedBy
      this.prisma.orderDiscount.findMany({
        where: {
          order: {
            ...storeFilter,
            status: OrderStatus.COMPLETED,
            posCreatedAt: { gte: start, lte: end },
          },
          appliedBy: { not: null },
        },
      }),
      // Shifts by operator (posOperatorId is always populated with portal user ID)
      this.prisma.shift.findMany({
        where: {
          ...storeFilter,
          openedAt: { gte: start, lte: end },
        },
      }),
    ]);

    // Build unified map per staff member
    const staffMap = new Map<string, {
      orderCount: number;
      totalSales: number;
      voidCount: number;
      voidAmount: number;
      refundCount: number;
      refundAmount: number;
      discountCount: number;
      discountAmount: number;
      shiftCount: number;
      totalShiftMs: number;
      cashVariance: number;
    }>();

    const ensureStaff = (id: string) => {
      if (!staffMap.has(id)) {
        staffMap.set(id, {
          orderCount: 0, totalSales: 0,
          voidCount: 0, voidAmount: 0,
          refundCount: 0, refundAmount: 0,
          discountCount: 0, discountAmount: 0,
          shiftCount: 0, totalShiftMs: 0, cashVariance: 0,
        });
      }
      return staffMap.get(id)!;
    };

    for (const order of completedOrders) {
      const staff = ensureStaff(order.operatorId!);
      staff.orderCount++;
      staff.totalSales += Number(order.grandTotal);
    }

    for (const order of voidedOrders) {
      const staff = ensureStaff(order.operatorId!);
      staff.voidCount++;
      staff.voidAmount += Number(order.grandTotal);
    }

    for (const refund of refunds) {
      const staff = ensureStaff(refund.processedBy!);
      staff.refundCount++;
      staff.refundAmount += Number(refund.amount);
    }

    for (const discount of discounts) {
      const staff = ensureStaff(discount.appliedBy!);
      staff.discountCount++;
      staff.discountAmount += Number(discount.discountAmount);
    }

    for (const shift of shifts) {
      const staff = ensureStaff(shift.posOperatorId);
      staff.shiftCount++;
      if (shift.closedAt) {
        staff.totalShiftMs += new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime();
      }
      staff.cashVariance += Number(shift.variance || 0);
    }

    // Resolve names in batch
    const operatorIds = Array.from(staffMap.keys());
    const users = operatorIds.length > 0 ? await this.prisma.user.findMany({
      where: { id: { in: operatorIds } },
      select: { id: true, firstName: true, lastName: true },
    }) : [];
    const userMap = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    return Array.from(staffMap.entries())
      .map(([operatorId, data]) => ({
        operatorId,
        operatorName: userMap.get(operatorId) || 'Unknown',
        orderCount: data.orderCount,
        totalSales: data.totalSales,
        averageOrderValue: data.orderCount > 0 ? data.totalSales / data.orderCount : 0,
        voidCount: data.voidCount,
        voidAmount: data.voidAmount,
        refundCount: data.refundCount,
        refundAmount: data.refundAmount,
        discountCount: data.discountCount,
        discountAmount: data.discountAmount,
        shiftCount: data.shiftCount,
        totalShiftHours: Math.round((data.totalShiftMs / (1000 * 60 * 60)) * 100) / 100,
        cashVariance: data.cashVariance,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }

  /**
   * Export data to CSV format
   */
  exportToCsv(data: any[], columns: { key: string; header: string }[]): string {
    const headers = columns.map(c => c.header).join(',');
    const rows = data.map(item =>
      columns.map(c => {
        const value = item[c.key];
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    );
    return [headers, ...rows].join('\n');
  }
}

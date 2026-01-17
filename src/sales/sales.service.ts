import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SyncOrderDto,
  SyncOrdersBatchDto,
  VoidOrderDto,
  OrderStatus,
  DiscountScope,
  SyncResult,
  BatchSyncResult,
} from './dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Sync a single order from POS to backend
   * Idempotent: If order with same posOrderId exists, returns existing order
   */
  async syncOrder(
    posDeviceId: string,
    branchId: string,
    storeId: string,
    orderDto: SyncOrderDto,
    syncBatchId?: string,
  ): Promise<SyncResult> {
    try {
      // Check if order already exists (idempotency check)
      const existingOrder = await this.prisma.order.findUnique({
        where: {
          posDeviceId_posOrderId: {
            posDeviceId,
            posOrderId: orderDto.posOrderId,
          },
        },
      });

      if (existingOrder) {
        // Order already synced, return existing
        return {
          success: true,
          posOrderId: orderDto.posOrderId,
          orderId: existingOrder.id,
          isNew: false,
        };
      }

      // Create new order with all related data in a transaction
      const order = await this.prisma.$transaction(async (tx) => {
        // Create the order
        const newOrder = await tx.order.create({
          data: {
            posOrderId: orderDto.posOrderId,
            posDeviceId,
            branchId,
            storeId,
            orderNumber: orderDto.orderNumber,
            orderType: orderDto.orderType || 'DINE_IN',
            status: orderDto.status || 'COMPLETED',
            subtotal: orderDto.subtotal,
            discountTotal: orderDto.discountTotal || 0,
            taxTotal: orderDto.taxTotal || 0,
            grandTotal: orderDto.grandTotal,
            customerName: orderDto.customerName,
            customerPhone: orderDto.customerPhone,
            notes: orderDto.notes,
            posCreatedAt: new Date(orderDto.posCreatedAt),
            posClosedAt: orderDto.posClosedAt ? new Date(orderDto.posClosedAt) : null,
            syncBatchId,
          },
        });

        // Create order items
        const orderItemsMap: Map<number, string> = new Map(); // index -> itemId for discount linking

        if (orderDto.items && orderDto.items.length > 0) {
          for (let i = 0; i < orderDto.items.length; i++) {
            const item = orderDto.items[i];
            const orderItem = await tx.orderItem.create({
              data: {
                orderId: newOrder.id,
                posItemId: item.posItemId,
                itemId: item.itemId,
                itemName: item.itemName,
                itemSku: item.itemSku,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountAmount: item.discountAmount || 0,
                taxAmount: item.taxAmount || 0,
                totalPrice: item.totalPrice,
                notes: item.notes,
                isVoided: item.isVoided || false,
                voidReason: item.voidReason,
              },
            });
            orderItemsMap.set(i, orderItem.id);
          }
        }

        // Create discounts
        if (orderDto.discounts && orderDto.discounts.length > 0) {
          for (const discount of orderDto.discounts) {
            const orderItemId = discount.discountScope === DiscountScope.ITEM &&
              discount.orderItemIndex !== undefined
                ? orderItemsMap.get(discount.orderItemIndex)
                : null;

            await tx.orderDiscount.create({
              data: {
                orderId: newOrder.id,
                orderItemId,
                discountName: discount.discountName,
                discountType: discount.discountType,
                discountScope: discount.discountScope,
                discountValue: discount.discountValue,
                discountAmount: discount.discountAmount,
                reason: discount.reason,
                appliedBy: discount.appliedBy,
              },
            });
          }
        }

        // Create payments
        const paymentsMap: Map<string, string> = new Map(); // posPaymentId -> paymentId for refund linking

        if (orderDto.payments && orderDto.payments.length > 0) {
          for (const payment of orderDto.payments) {
            const newPayment = await tx.payment.create({
              data: {
                posPaymentId: payment.posPaymentId,
                orderId: newOrder.id,
                paymentMethod: payment.paymentMethod,
                status: payment.status || 'COMPLETED',
                amount: payment.amount,
                tipAmount: payment.tipAmount || 0,
                changeAmount: payment.changeAmount || 0,
                referenceNumber: payment.referenceNumber,
                processedAt: new Date(payment.processedAt),
              },
            });
            paymentsMap.set(payment.posPaymentId, newPayment.id);
          }
        }

        // Create refunds
        if (orderDto.refunds && orderDto.refunds.length > 0) {
          for (const refund of orderDto.refunds) {
            const paymentId = refund.posPaymentId
              ? paymentsMap.get(refund.posPaymentId)
              : null;

            await tx.refund.create({
              data: {
                posRefundId: refund.posRefundId,
                orderId: newOrder.id,
                paymentId,
                amount: refund.amount,
                reason: refund.reason,
                refundMethod: refund.refundMethod,
                processedBy: refund.processedBy,
                processedAt: new Date(refund.processedAt),
              },
            });
          }
        }

        return newOrder;
      });

      return {
        success: true,
        posOrderId: orderDto.posOrderId,
        orderId: order.id,
        isNew: true,
      };
    } catch (error) {
      return {
        success: false,
        posOrderId: orderDto.posOrderId,
        error: error instanceof Error ? error.message : 'Unknown error',
        isNew: false,
      };
    }
  }

  /**
   * Batch sync multiple orders from POS
   * Processes each order independently to allow partial success
   */
  async syncOrdersBatch(
    posDeviceId: string,
    branchId: string,
    storeId: string,
    batchDto: SyncOrdersBatchDto,
  ): Promise<BatchSyncResult> {
    const syncBatchId = batchDto.syncBatchId || uuidv4();
    const results: SyncResult[] = [];

    for (const orderDto of batchDto.orders) {
      const result = await this.syncOrder(
        posDeviceId,
        branchId,
        storeId,
        orderDto,
        syncBatchId,
      );
      results.push(result);
    }

    const successful = results.filter(r => r.success && r.isNew).length;
    const skipped = results.filter(r => r.success && !r.isNew).length;
    const failed = results.filter(r => !r.success).length;

    return {
      syncBatchId,
      totalOrders: batchDto.orders.length,
      successful,
      failed,
      skipped,
      results,
    };
  }

  /**
   * Void an order
   */
  async voidOrder(
    posDeviceId: string,
    voidDto: VoidOrderDto,
  ): Promise<{ success: boolean; orderId: string }> {
    const order = await this.prisma.order.findUnique({
      where: {
        posDeviceId_posOrderId: {
          posDeviceId,
          posOrderId: voidDto.posOrderId,
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with posOrderId ${voidDto.posOrderId} not found`);
    }

    if (order.status === 'VOIDED') {
      return { success: true, orderId: order.id };
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'VOIDED',
        notes: voidDto.reason
          ? `${order.notes || ''}\nVOIDED: ${voidDto.reason}`.trim()
          : order.notes,
      },
    });

    return { success: true, orderId: order.id };
  }

  /**
   * Get orders for a store with filtering options
   */
  async getOrders(
    storeId?: string,
    options: {
      branchId?: string;
      posDeviceId?: string;
      status?: OrderStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { branchId, posDeviceId, status, startDate, endDate, page = 1, limit = 20 } = options;

    const where = {
      ...(storeId && { storeId }),
      ...(branchId && { branchId }),
      ...(posDeviceId && { posDeviceId }),
      ...(status && { status }),
      ...(startDate || endDate
        ? {
            posCreatedAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          orderItems: true,
          payments: true,
          discounts: true,
          refunds: true,
          posDevice: {
            select: {
              id: true,
              name: true,
              deviceIdentifier: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { posCreatedAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single order by ID
   */
  async getOrderById(orderId: string, storeId?: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...(storeId && { storeId }),
      },
      include: {
        orderItems: {
          include: {
            discounts: true,
            item: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        payments: {
          include: {
            refunds: true,
          },
        },
        discounts: true,
        refunds: true,
        posDevice: {
          select: {
            id: true,
            name: true,
            deviceIdentifier: true,
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Get sales summary for a store
   */
  async getSalesSummary(
    storeId: string,
    options: {
      branchId?: string;
      startDate: Date;
      endDate: Date;
    },
  ) {
    const { branchId, startDate, endDate } = options;

    const where = {
      storeId,
      ...(branchId && { branchId }),
      posCreatedAt: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        notIn: ['VOIDED'] as ('VOIDED')[],
      },
    };

    const [summary, orderCount] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _sum: {
          subtotal: true,
          discountTotal: true,
          taxTotal: true,
          grandTotal: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    // Get payments grouped by method for orders in the date range
    const payments = await this.prisma.payment.findMany({
      where: {
        order: where,
        status: 'COMPLETED',
      },
      select: {
        paymentMethod: true,
        amount: true,
        tipAmount: true,
      },
    });

    // Manually group payments by method
    const paymentsByMethod = payments.reduce((acc, payment) => {
      const method = payment.paymentMethod;
      if (!acc[method]) {
        acc[method] = { count: 0, amount: 0, tips: 0 };
      }
      acc[method].count += 1;
      acc[method].amount += Number(payment.amount);
      acc[method].tips += Number(payment.tipAmount);
      return acc;
    }, {} as Record<string, { count: number; amount: number; tips: number }>);

    const refundTotal = await this.prisma.refund.aggregate({
      where: {
        order: where,
      },
      _sum: {
        amount: true,
      },
    });

    return {
      period: {
        startDate,
        endDate,
      },
      orders: {
        count: orderCount,
        subtotal: Number(summary._sum.subtotal) || 0,
        discountTotal: Number(summary._sum.discountTotal) || 0,
        taxTotal: Number(summary._sum.taxTotal) || 0,
        grandTotal: Number(summary._sum.grandTotal) || 0,
      },
      refunds: {
        total: Number(refundTotal._sum.amount) || 0,
      },
      netSales: (Number(summary._sum.grandTotal) || 0) - (Number(refundTotal._sum.amount) || 0),
      paymentsByMethod: Object.entries(paymentsByMethod).map(([method, data]) => ({
        method,
        count: data.count,
        amount: data.amount,
        tips: data.tips,
      })),
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftStatus, CashMovementType, Prisma } from '@prisma/client';
import { SyncShiftDto, SyncShiftResult } from './dto';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Sync shift from POS device (idempotent)
   */
  async syncShift(
    posDeviceId: string,
    branchId: string,
    storeId: string,
    dto: SyncShiftDto,
  ): Promise<SyncShiftResult> {
    try {
      // Check for existing shift (idempotency)
      const existingShift = await this.prisma.shift.findUnique({
        where: {
          posDeviceId_posShiftId: {
            posDeviceId,
            posShiftId: dto.posShiftId,
          },
        },
      });

      if (existingShift) {
        // Update existing shift
        await this.prisma.shift.update({
          where: { id: existingShift.id },
          data: {
            status: dto.status as ShiftStatus,
            operatorId: dto.posOperatorId,
            closedAt: dto.closedAt ? new Date(dto.closedAt) : null,
            closingCash: dto.closingCash,
            expectedCash: dto.expectedCash,
            variance: dto.variance,
            notes: dto.notes,
            orderCount: dto.orderCount,
          },
        });

        // Update cash movements (delete and recreate)
        await this.prisma.cashMovement.deleteMany({
          where: { shiftId: existingShift.id },
        });

        if (dto.cashMovements && dto.cashMovements.length > 0) {
          await this.prisma.cashMovement.createMany({
            data: dto.cashMovements.map((m) => ({
              shiftId: existingShift.id,
              movementType: m.movementType as CashMovementType,
              amount: m.amount,
              referenceType: m.referenceType,
              referenceId: m.referenceId,
              reason: m.reason,
              performedBy: m.performedBy,
              performedAt: new Date(m.performedAt),
            })),
          });
        }

        return {
          success: true,
          posShiftId: dto.posShiftId,
          shiftId: existingShift.id,
          isNew: false,
        };
      }

      // Create new shift
      const shift = await this.prisma.shift.create({
        data: {
          posShiftId: dto.posShiftId,
          posDeviceId,
          branchId,
          storeId,
          posOperatorId: dto.posOperatorId,
          operatorId: dto.posOperatorId,
          status: dto.status as ShiftStatus,
          openedAt: new Date(dto.openedAt),
          closedAt: dto.closedAt ? new Date(dto.closedAt) : null,
          openingCash: dto.openingCash,
          closingCash: dto.closingCash,
          expectedCash: dto.expectedCash,
          variance: dto.variance,
          notes: dto.notes,
          orderCount: dto.orderCount,
          cashMovements: {
            create: dto.cashMovements.map((m) => ({
              movementType: m.movementType as CashMovementType,
              amount: m.amount,
              referenceType: m.referenceType,
              referenceId: m.referenceId,
              reason: m.reason,
              performedBy: m.performedBy,
              performedAt: new Date(m.performedAt),
            })),
          },
        },
      });

      return {
        success: true,
        posShiftId: dto.posShiftId,
        shiftId: shift.id,
        isNew: true,
      };
    } catch (error) {
      return {
        success: false,
        posShiftId: dto.posShiftId,
        error: error.message,
        isNew: false,
      };
    }
  }

  /**
   * Get shifts with filters
   */
  async getShifts(
    storeId: string,
    options?: {
      branchId?: string;
      posDeviceId?: string;
      operatorId?: string;
      status?: ShiftStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    const where: Prisma.ShiftWhereInput = { storeId };

    if (options?.branchId) {
      where.branchId = options.branchId;
    }

    if (options?.posDeviceId) {
      where.posDeviceId = options.posDeviceId;
    }

    if (options?.operatorId) {
      where.operatorId = options.operatorId;
    }

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.startDate || options?.endDate) {
      where.openedAt = {};
      if (options?.startDate) {
        where.openedAt.gte = options.startDate;
      }
      if (options?.endDate) {
        where.openedAt.lte = options.endDate;
      }
    }

    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const [shifts, total] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        include: {
          posDevice: {
            select: { id: true, name: true, deviceIdentifier: true },
          },
          operator: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { orders: true, cashMovements: true },
          },
        },
        orderBy: { openedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.shift.count({ where }),
    ]);

    return {
      data: shifts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get shift by ID
   */
  async getShiftById(id: string, storeId?: string) {
    const where: Prisma.ShiftWhereInput = { id };
    if (storeId) {
      where.storeId = storeId;
    }

    const shift = await this.prisma.shift.findFirst({
      where,
      include: {
        posDevice: {
          select: { id: true, name: true, deviceIdentifier: true },
        },
        operator: {
          select: { id: true, firstName: true, lastName: true },
        },
        cashMovements: {
          orderBy: { performedAt: 'asc' },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            grandTotal: true,
            status: true,
            posCreatedAt: true,
          },
          orderBy: { posCreatedAt: 'asc' },
        },
      },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    return shift;
  }

  /**
   * Get shift summary/stats for a period
   */
  async getShiftsSummary(
    storeId: string,
    options: {
      branchId?: string;
      startDate: Date;
      endDate: Date;
    },
  ) {
    const where: Prisma.ShiftWhereInput = {
      storeId,
      openedAt: {
        gte: options.startDate,
        lte: options.endDate,
      },
    };

    if (options.branchId) {
      where.branchId = options.branchId;
    }

    const shifts = await this.prisma.shift.findMany({
      where,
      include: {
        cashMovements: true,
      },
    });

    const totalShifts = shifts.length;
    let closedShifts = 0;
    let totalOpeningCash = 0;
    let totalClosingCash = 0;
    let totalVariance = 0;
    let positiveVariances = 0;
    let negativeVariances = 0;
    let totalOrders = 0;

    for (const shift of shifts) {
      totalOpeningCash += Number(shift.openingCash);
      totalOrders += shift.orderCount;

      if (shift.status === 'CLOSED') {
        closedShifts++;
        if (shift.closingCash !== null) {
          totalClosingCash += Number(shift.closingCash);
        }
        if (shift.variance !== null) {
          const variance = Number(shift.variance);
          totalVariance += variance;
          if (variance > 0) positiveVariances++;
          if (variance < 0) negativeVariances++;
        }
      }
    }

    return {
      totalShifts,
      closedShifts,
      openShifts: totalShifts - closedShifts,
      totalOpeningCash,
      totalClosingCash,
      totalVariance,
      averageVariance: closedShifts > 0 ? totalVariance / closedShifts : 0,
      positiveVariances,
      negativeVariances,
      shiftsWithVariance: positiveVariances + negativeVariances,
      totalOrders,
    };
  }

  /**
   * Get shifts with cash discrepancies (variances)
   */
  async getShiftsWithVariances(
    storeId: string,
    options?: {
      branchId?: string;
      minVariance?: number;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    const where: Prisma.ShiftWhereInput = {
      storeId,
      status: 'CLOSED',
      variance: {
        not: 0,
      },
    };

    if (options?.branchId) {
      where.branchId = options.branchId;
    }

    if (options?.minVariance) {
      // Find shifts where absolute variance is greater than minVariance
      where.OR = [
        { variance: { gte: options.minVariance } },
        { variance: { lte: -options.minVariance } },
      ];
    }

    if (options?.startDate || options?.endDate) {
      where.openedAt = {};
      if (options?.startDate) {
        where.openedAt.gte = options.startDate;
      }
      if (options?.endDate) {
        where.openedAt.lte = options.endDate;
      }
    }

    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const [shifts, total] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        include: {
          posDevice: {
            select: { id: true, name: true, deviceIdentifier: true },
          },
          operator: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: [
          { variance: 'asc' }, // Most negative first
        ],
        skip,
        take: limit,
      }),
      this.prisma.shift.count({ where }),
    ]);

    return {
      data: shifts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

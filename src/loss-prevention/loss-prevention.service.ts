import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  LossPreventionScope,
  IncidentStatus,
  AlertSeverity,
  DEFAULT_THRESHOLDS,
  SEVERITY_MULTIPLIERS,
} from './loss-prevention.constants';
import type {
  LossPreventionThreshold,
  LossPreventionIncident,
  CreateThresholdDto,
  UpdateThresholdDto,
  CreateIncidentDto,
  ResolveIncidentDto,
  IncidentFilters,
  IncidentStats,
  ThresholdWithStats,
  DashboardSummary,
} from './loss-prevention.types';

@Injectable()
export class LossPreventionService {
  private readonly logger = new Logger(LossPreventionService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ==================== Threshold Management ====================

  /**
   * Initialize default thresholds for a store
   */
  async initializeDefaultThresholds(storeId: string): Promise<number> {
    let count = 0;

    for (const defaultThreshold of DEFAULT_THRESHOLDS) {
      try {
        await (this.prisma as any).lossPreventionThreshold.create({
          data: {
            storeId,
            metricType: defaultThreshold.metricType,
            threshold: defaultThreshold.threshold,
            timeWindow: defaultThreshold.timeWindow,
            scope: defaultThreshold.scope,
            enabled: true,
          },
        });
        count++;
      } catch {
        // Threshold might already exist, skip
      }
    }

    this.logger.log(
      `Initialized ${count} default thresholds for store ${storeId}`,
    );
    return count;
  }

  /**
   * Get all thresholds for a store
   */
  async getThresholds(storeId: string): Promise<LossPreventionThreshold[]> {
    return (this.prisma as any).lossPreventionThreshold.findMany({
      where: { storeId },
      orderBy: [{ metricType: 'asc' }, { scope: 'asc' }],
    });
  }

  /**
   * Get thresholds with incident stats
   */
  async getThresholdsWithStats(storeId: string): Promise<ThresholdWithStats[]> {
    const thresholds = await this.getThresholds(storeId);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result: ThresholdWithStats[] = [];

    for (const threshold of thresholds) {
      const incidents = await (
        this.prisma as any
      ).lossPreventionIncident.findMany({
        where: {
          storeId,
          metricType: threshold.metricType,
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      result.push({
        ...threshold,
        threshold: Number(threshold.threshold),
        incidentCount: incidents.length,
        lastIncidentAt: incidents[0]?.createdAt || null,
      });
    }

    return result;
  }

  /**
   * Get a specific threshold
   */
  async getThreshold(id: string): Promise<LossPreventionThreshold | null> {
    return (this.prisma as any).lossPreventionThreshold.findUnique({
      where: { id },
    });
  }

  /**
   * Create a new threshold
   */
  async createThreshold(
    dto: CreateThresholdDto,
  ): Promise<LossPreventionThreshold> {
    const threshold = await (this.prisma as any).lossPreventionThreshold.create(
      {
        data: {
          storeId: dto.storeId,
          metricType: dto.metricType,
          threshold: dto.threshold,
          timeWindow: dto.timeWindow,
          scope: dto.scope,
          enabled: dto.enabled ?? true,
        },
      },
    );

    this.logger.log(
      `Created threshold: ${dto.metricType} for store ${dto.storeId}`,
    );
    return threshold;
  }

  /**
   * Update a threshold
   */
  async updateThreshold(
    id: string,
    dto: UpdateThresholdDto,
    userId: string,
  ): Promise<LossPreventionThreshold> {
    const existing = await this.getThreshold(id);
    if (!existing) {
      throw new NotFoundException('Threshold not found');
    }

    const threshold = await (this.prisma as any).lossPreventionThreshold.update(
      {
        where: { id },
        data: dto,
      },
    );

    await this.auditService.log({
      userId,
      storeId: existing.storeId,
      action: 'UPDATE',
      entityType: 'LossPreventionThreshold',
      entityId: id,
      oldValue: existing,
      newValue: threshold,
    });

    return threshold;
  }

  /**
   * Delete a threshold
   */
  async deleteThreshold(id: string, userId: string): Promise<void> {
    const existing = await this.getThreshold(id);
    if (!existing) {
      throw new NotFoundException('Threshold not found');
    }

    await (this.prisma as any).lossPreventionThreshold.delete({
      where: { id },
    });

    await this.auditService.log({
      userId,
      storeId: existing.storeId,
      action: 'DELETE',
      entityType: 'LossPreventionThreshold',
      entityId: id,
      oldValue: existing,
    });
  }

  /**
   * Get enabled thresholds for evaluation
   */
  async getEnabledThresholds(
    storeId: string,
    scope?: LossPreventionScope,
  ): Promise<LossPreventionThreshold[]> {
    const where: any = { storeId, enabled: true };
    if (scope) where.scope = scope;

    return (this.prisma as any).lossPreventionThreshold.findMany({ where });
  }

  // ==================== Incident Management ====================

  /**
   * Create a new incident
   */
  async createIncident(
    dto: CreateIncidentDto,
  ): Promise<LossPreventionIncident> {
    // Calculate severity based on how much the threshold is exceeded
    const percentageOver =
      ((dto.actualValue - dto.thresholdValue) / dto.thresholdValue) * 100;

    let severity = AlertSeverity.WARNING;
    if (
      percentageOver >=
      (SEVERITY_MULTIPLIERS[AlertSeverity.CRITICAL] - 1) * 100
    ) {
      severity = AlertSeverity.CRITICAL;
    } else if (
      percentageOver >=
      (SEVERITY_MULTIPLIERS[AlertSeverity.WARNING] - 1) * 100
    ) {
      severity = AlertSeverity.WARNING;
    } else {
      severity = AlertSeverity.INFO;
    }

    const incident = await (this.prisma as any).lossPreventionIncident.create({
      data: {
        storeId: dto.storeId,
        branchId: dto.branchId,
        staffId: dto.staffId || null,
        posDeviceId: dto.posDeviceId || null,
        metricType: dto.metricType,
        actualValue: dto.actualValue,
        thresholdValue: dto.thresholdValue,
        timeWindow: dto.timeWindow,
        transactions: dto.transactions,
        severity: dto.severity || severity,
        status: IncidentStatus.OPEN,
      },
    });

    this.logger.warn(
      `Loss prevention incident created: ${dto.metricType} exceeded threshold ` +
        `(${dto.actualValue} > ${dto.thresholdValue}) at branch ${dto.branchId}`,
    );

    return incident;
  }

  /**
   * Get incidents with filters
   */
  async getIncidents(
    filters: IncidentFilters,
  ): Promise<LossPreventionIncident[]> {
    const where: any = { storeId: filters.storeId };

    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.staffId) where.staffId = filters.staffId;
    if (filters.status) where.status = filters.status;
    if (filters.metricType) where.metricType = filters.metricType;
    if (filters.severity) where.severity = filters.severity;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    return (this.prisma as any).lossPreventionIncident.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
        posDevice: { select: { id: true, name: true, deviceIdentifier: true } },
        resolver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    });
  }

  /**
   * Get a specific incident
   */
  async getIncident(id: string): Promise<LossPreventionIncident | null> {
    return (this.prisma as any).lossPreventionIncident.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
        posDevice: { select: { id: true, name: true, deviceIdentifier: true } },
        resolver: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Acknowledge an incident
   */
  async acknowledgeIncident(
    id: string,
    userId: string,
  ): Promise<LossPreventionIncident> {
    const incident = await this.getIncident(id);
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    if (incident.status !== IncidentStatus.OPEN) {
      throw new BadRequestException('Can only acknowledge open incidents');
    }

    return (this.prisma as any).lossPreventionIncident.update({
      where: { id },
      data: {
        status: IncidentStatus.ACKNOWLEDGED,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });
  }

  /**
   * Resolve an incident
   */
  async resolveIncident(
    id: string,
    dto: ResolveIncidentDto,
    userId: string,
  ): Promise<LossPreventionIncident> {
    const incident = await this.getIncident(id);
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    if (incident.status === IncidentStatus.RESOLVED) {
      throw new BadRequestException('Incident is already resolved');
    }

    const updated = await (this.prisma as any).lossPreventionIncident.update({
      where: { id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolution: dto.resolution,
        resolvedBy: userId,
        resolvedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId,
      storeId: incident.storeId,
      action: 'UPDATE',
      entityType: 'LossPreventionIncident',
      entityId: id,
      newValue: { status: 'RESOLVED', resolution: dto.resolution },
    });

    return updated;
  }

  /**
   * Escalate an incident
   */
  async escalateIncident(
    id: string,
    userId: string,
  ): Promise<LossPreventionIncident> {
    const incident = await this.getIncident(id);
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    if (incident.status === IncidentStatus.RESOLVED) {
      throw new BadRequestException('Cannot escalate a resolved incident');
    }

    const updated = await (this.prisma as any).lossPreventionIncident.update({
      where: { id },
      data: {
        status: IncidentStatus.ESCALATED,
        severity: AlertSeverity.CRITICAL,
      },
    });

    await this.auditService.log({
      userId,
      storeId: incident.storeId,
      action: 'UPDATE',
      entityType: 'LossPreventionIncident',
      entityId: id,
      newValue: { status: 'ESCALATED' },
    });

    return updated;
  }

  // ==================== Statistics & Dashboard ====================

  /**
   * Get incident statistics for a store
   */
  async getIncidentStats(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<IncidentStats> {
    const where: any = { storeId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, open, acknowledged, resolved, escalated] = await Promise.all([
      (this.prisma as any).lossPreventionIncident.count({ where }),
      (this.prisma as any).lossPreventionIncident.count({
        where: { ...where, status: IncidentStatus.OPEN },
      }),
      (this.prisma as any).lossPreventionIncident.count({
        where: { ...where, status: IncidentStatus.ACKNOWLEDGED },
      }),
      (this.prisma as any).lossPreventionIncident.count({
        where: { ...where, status: IncidentStatus.RESOLVED },
      }),
      (this.prisma as any).lossPreventionIncident.count({
        where: { ...where, status: IncidentStatus.ESCALATED },
      }),
    ]);

    // Group by metric type
    const byMetricTypeRaw = await (
      this.prisma as any
    ).lossPreventionIncident.groupBy({
      by: ['metricType'],
      where,
      _count: true,
    });
    const byMetricType: Record<string, number> = {};
    for (const item of byMetricTypeRaw) {
      byMetricType[item.metricType] = item._count;
    }

    // Group by severity
    const bySeverityRaw = await (
      this.prisma as any
    ).lossPreventionIncident.groupBy({
      by: ['severity'],
      where,
      _count: true,
    });
    const bySeverity: Record<string, number> = {};
    for (const item of bySeverityRaw) {
      bySeverity[item.severity] = item._count;
    }

    // Group by branch
    const byBranchRaw = await (
      this.prisma as any
    ).lossPreventionIncident.groupBy({
      by: ['branchId'],
      where,
      _count: true,
      orderBy: { _count: { branchId: 'desc' } },
      take: 10,
    });

    const branchIds = byBranchRaw.map((b: any) => b.branchId);
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true },
    });
    const branchMap = new Map(branches.map((b) => [b.id, b.name]));

    const byBranch = byBranchRaw.map((item: any) => ({
      branchId: item.branchId,
      branchName: branchMap.get(item.branchId) || 'Unknown',
      count: item._count,
    }));

    // Top offenders (staff with most incidents)
    const topOffendersRaw = await (
      this.prisma as any
    ).lossPreventionIncident.groupBy({
      by: ['staffId'],
      where: { ...where, staffId: { not: null } },
      _count: true,
      orderBy: { _count: { staffId: 'desc' } },
      take: 10,
    });

    const staffIds = topOffendersRaw.map((s: any) => s.staffId).filter(Boolean);
    const staff = await this.prisma.user.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const staffMap = new Map(
      staff.map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
    );

    const topOffenders = topOffendersRaw
      .filter((item: any) => item.staffId)
      .map((item: any) => ({
        staffId: item.staffId,
        staffName: staffMap.get(item.staffId) || 'Unknown',
        incidentCount: item._count,
      }));

    return {
      total,
      open,
      acknowledged,
      resolved,
      escalated,
      byMetricType,
      bySeverity,
      byBranch,
      topOffenders,
    };
  }

  /**
   * Get dashboard summary for a store
   */
  async getDashboardSummary(storeId: string): Promise<DashboardSummary> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get threshold counts
    const [totalThresholds, enabledThresholds] = await Promise.all([
      (this.prisma as any).lossPreventionThreshold.count({
        where: { storeId },
      }),
      (this.prisma as any).lossPreventionThreshold.count({
        where: { storeId, enabled: true },
      }),
    ]);

    // Get incident counts by status
    const [
      totalIncidents,
      openIncidents,
      acknowledgedIncidents,
      resolvedIncidents,
      escalatedIncidents,
      recentIncidents,
    ] = await Promise.all([
      (this.prisma as any).lossPreventionIncident.count({
        where: { storeId },
      }),
      (this.prisma as any).lossPreventionIncident.count({
        where: { storeId, status: IncidentStatus.OPEN },
      }),
      (this.prisma as any).lossPreventionIncident.count({
        where: { storeId, status: IncidentStatus.ACKNOWLEDGED },
      }),
      (this.prisma as any).lossPreventionIncident.count({
        where: { storeId, status: IncidentStatus.RESOLVED },
      }),
      (this.prisma as any).lossPreventionIncident.count({
        where: { storeId, status: IncidentStatus.ESCALATED },
      }),
      (this.prisma as any).lossPreventionIncident.findMany({
        where: { storeId },
        include: {
          branch: { select: { id: true, name: true } },
          staff: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Get incidents by severity
    const bySeverityRaw = await (
      this.prisma as any
    ).lossPreventionIncident.groupBy({
      by: ['severity'],
      where: { storeId },
      _count: true,
    });
    const incidentsBySeverity = { INFO: 0, WARNING: 0, CRITICAL: 0 };
    for (const item of bySeverityRaw) {
      if (item.severity in incidentsBySeverity) {
        incidentsBySeverity[item.severity as keyof typeof incidentsBySeverity] =
          item._count;
      }
    }

    // Get metric trends
    const currentWeekIncidents = await (
      this.prisma as any
    ).lossPreventionIncident.groupBy({
      by: ['metricType'],
      where: { storeId, createdAt: { gte: sevenDaysAgo } },
      _count: true,
    });

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const lastWeekIncidents = await (
      this.prisma as any
    ).lossPreventionIncident.groupBy({
      by: ['metricType'],
      where: {
        storeId,
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
      _count: true,
    });

    const lastWeekMap = new Map(
      lastWeekIncidents.map((i: any) => [i.metricType, i._count]),
    );

    const topMetrics = currentWeekIncidents.map((item: any) => {
      const lastWeekCount = lastWeekMap.get(item.metricType) || 0;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (item._count > lastWeekCount) trend = 'up';
      else if (item._count < lastWeekCount) trend = 'down';

      return {
        metricType: item.metricType,
        incidentCount: item._count,
        trend,
      };
    });

    // Calculate risk score (0-100)
    let riskScore = 0;
    riskScore += Math.min(openIncidents * 5, 30);
    riskScore += Math.min(incidentsBySeverity.CRITICAL * 15, 40);
    const upTrends = topMetrics.filter((m: any) => m.trend === 'up').length;
    riskScore += Math.min(upTrends * 10, 30);

    return {
      totalThresholds,
      enabledThresholds,
      totalIncidents,
      openIncidents,
      acknowledgedIncidents,
      resolvedIncidents,
      escalatedIncidents,
      incidentsBySeverity,
      recentIncidents,
      topMetrics,
      riskScore: Math.min(riskScore, 100),
    };
  }
}

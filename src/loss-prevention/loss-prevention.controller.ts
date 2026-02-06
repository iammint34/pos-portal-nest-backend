import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FeatureFlagGuard } from '../common/guards/feature-flag.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequireFeature } from '../common/decorators/feature-flag.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FeatureKey } from '../feature-flags/feature-flags.constants';
import { LossPreventionService } from './loss-prevention.service';
import { LossPreventionEvaluatorService } from './loss-prevention-evaluator.service';
import {
  LossPreventionMetricType,
  LossPreventionTimeWindow,
  LossPreventionScope,
  IncidentStatus,
  AlertSeverity,
} from './loss-prevention.constants';

// DTOs
class CreateThresholdDto {
  metricType: LossPreventionMetricType;
  threshold: number;
  timeWindow: LossPreventionTimeWindow;
  scope: LossPreventionScope;
  enabled?: boolean;
}

class UpdateThresholdDto {
  threshold?: number;
  timeWindow?: LossPreventionTimeWindow;
  enabled?: boolean;
}

class ResolveIncidentDto {
  resolution: string;
}

@ApiTags('Loss Prevention')
@ApiBearerAuth()
@Controller('api/v1/stores/:storeId/loss-prevention')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature(FeatureKey.LOSS_PREVENTION)
export class LossPreventionController {
  constructor(
    private readonly lossPreventionService: LossPreventionService,
    private readonly evaluatorService: LossPreventionEvaluatorService,
  ) {}

  // ==================== Dashboard ====================

  @Get('dashboard')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get loss prevention dashboard summary' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Dashboard summary retrieved' })
  async getDashboard(@Param('storeId') storeId: string) {
    return this.lossPreventionService.getDashboardSummary(storeId);
  }

  // ==================== Thresholds ====================

  @Get('thresholds')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get all loss prevention thresholds' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Thresholds retrieved' })
  async getThresholds(@Param('storeId') storeId: string) {
    return this.lossPreventionService.getThresholdsWithStats(storeId);
  }

  @Post('thresholds')
  @Permissions('store.update')
  @ApiOperation({ summary: 'Create a new threshold' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 201, description: 'Threshold created' })
  async createThreshold(
    @Param('storeId') storeId: string,
    @Body() dto: CreateThresholdDto,
  ) {
    return this.lossPreventionService.createThreshold({
      storeId,
      ...dto,
    });
  }

  @Post('thresholds/initialize')
  @Permissions('store.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize default thresholds for store' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Default thresholds initialized' })
  async initializeThresholds(@Param('storeId') storeId: string) {
    const count =
      await this.lossPreventionService.initializeDefaultThresholds(storeId);
    return { message: `Initialized ${count} default thresholds` };
  }

  @Patch('thresholds/:thresholdId')
  @Permissions('store.update')
  @ApiOperation({ summary: 'Update a threshold' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({ name: 'thresholdId', description: 'Threshold ID' })
  @ApiResponse({ status: 200, description: 'Threshold updated' })
  async updateThreshold(
    @Param('thresholdId') thresholdId: string,
    @Body() dto: UpdateThresholdDto,
    @CurrentUser() user: any,
  ) {
    return this.lossPreventionService.updateThreshold(
      thresholdId,
      dto,
      user.id,
    );
  }

  @Delete('thresholds/:thresholdId')
  @Permissions('store.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a threshold' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({ name: 'thresholdId', description: 'Threshold ID' })
  @ApiResponse({ status: 204, description: 'Threshold deleted' })
  async deleteThreshold(
    @Param('thresholdId') thresholdId: string,
    @CurrentUser() user: any,
  ) {
    await this.lossPreventionService.deleteThreshold(thresholdId, user.id);
  }

  // ==================== Incidents ====================

  @Get('incidents')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get loss prevention incidents' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'staffId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: IncidentStatus })
  @ApiQuery({
    name: 'metricType',
    required: false,
    enum: LossPreventionMetricType,
  })
  @ApiQuery({ name: 'severity', required: false, enum: AlertSeverity })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Incidents retrieved' })
  async getIncidents(
    @Param('storeId') storeId: string,
    @Query('branchId') branchId?: string,
    @Query('staffId') staffId?: string,
    @Query('status') status?: IncidentStatus,
    @Query('metricType') metricType?: LossPreventionMetricType,
    @Query('severity') severity?: AlertSeverity,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.lossPreventionService.getIncidents({
      storeId,
      branchId,
      staffId,
      status,
      metricType,
      severity,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('incidents/stats')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get incident statistics' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getIncidentStats(
    @Param('storeId') storeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.lossPreventionService.getIncidentStats(
      storeId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('incidents/:incidentId')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get a specific incident' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({ name: 'incidentId', description: 'Incident ID' })
  @ApiResponse({ status: 200, description: 'Incident retrieved' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async getIncident(@Param('incidentId') incidentId: string) {
    const incident = await this.lossPreventionService.getIncident(incidentId);
    if (!incident) {
      return { error: 'Incident not found', statusCode: 404 };
    }
    return incident;
  }

  @Post('incidents/:incidentId/acknowledge')
  @Permissions('store.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge an incident' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({ name: 'incidentId', description: 'Incident ID' })
  @ApiResponse({ status: 200, description: 'Incident acknowledged' })
  async acknowledgeIncident(
    @Param('incidentId') incidentId: string,
    @CurrentUser() user: any,
  ) {
    return this.lossPreventionService.acknowledgeIncident(incidentId, user.id);
  }

  @Post('incidents/:incidentId/resolve')
  @Permissions('store.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve an incident' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({ name: 'incidentId', description: 'Incident ID' })
  @ApiResponse({ status: 200, description: 'Incident resolved' })
  async resolveIncident(
    @Param('incidentId') incidentId: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser() user: any,
  ) {
    return this.lossPreventionService.resolveIncident(incidentId, dto, user.id);
  }

  @Post('incidents/:incidentId/escalate')
  @Permissions('store.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Escalate an incident' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({ name: 'incidentId', description: 'Incident ID' })
  @ApiResponse({ status: 200, description: 'Incident escalated' })
  async escalateIncident(
    @Param('incidentId') incidentId: string,
    @CurrentUser() user: any,
  ) {
    return this.lossPreventionService.escalateIncident(incidentId, user.id);
  }

  // ==================== Evaluation ====================

  @Post('evaluate')
  @Permissions('store.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger manual evaluation' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Evaluation completed' })
  async triggerEvaluation(@Param('storeId') storeId: string) {
    const results = await this.evaluatorService.triggerEvaluation(storeId);
    return {
      message: 'Evaluation completed',
      incidentsCreated: results.reduce((sum, r) => sum + r.incidents.length, 0),
      results,
    };
  }
}

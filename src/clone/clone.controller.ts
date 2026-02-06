import {
  Controller,
  Get,
  Post,
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
import { CloneService } from './clone.service';
import { CloneBranchDto } from './dto/clone-branch.dto';
import { CloneStoreDto } from './dto/clone-store.dto';
import { ClonePreviewDto } from './dto/clone-preview.dto';
import { FeatureKey } from '../feature-flags/feature-flags.constants';

@ApiTags('Clone')
@ApiBearerAuth()
@Controller('api/v1')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
export class CloneController {
  constructor(private readonly cloneService: CloneService) {}

  // ==================== Branch Cloning ====================

  @Post('stores/:storeId/clone/branch')
  @RequireFeature(FeatureKey.STORE_CLONING)
  @Permissions('branch.create')
  @ApiOperation({ summary: 'Clone a branch within a store' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 201, description: 'Branch cloned successfully' })
  @ApiResponse({ status: 404, description: 'Source branch not found' })
  @ApiResponse({
    status: 400,
    description: 'Branch with this name already exists',
  })
  async cloneBranch(
    @Param('storeId') storeId: string,
    @Body() dto: CloneBranchDto,
    @CurrentUser() user: any,
  ) {
    return this.cloneService.cloneBranch(storeId, dto, user.id);
  }

  // ==================== Store Cloning ====================

  @Post('clone/store')
  @RequireFeature(FeatureKey.STORE_CLONING)
  @Permissions('store.create')
  @ApiOperation({ summary: 'Clone an entire store' })
  @ApiResponse({ status: 201, description: 'Store cloned successfully' })
  @ApiResponse({ status: 404, description: 'Source store not found' })
  async cloneStore(@Body() dto: CloneStoreDto, @CurrentUser() user: any) {
    return this.cloneService.cloneStore(dto, user.id);
  }

  // ==================== Preview ====================

  @Post('stores/:storeId/clone/preview')
  @RequireFeature(FeatureKey.STORE_CLONING)
  @Permissions('store.read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview what will be cloned (dry run)' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Clone preview generated' })
  async previewClone(
    @Param('storeId') storeId: string,
    @Body() dto: ClonePreviewDto,
  ) {
    return this.cloneService.previewClone(storeId, dto);
  }

  // ==================== Clone Jobs ====================

  @Get('stores/:storeId/clone/jobs')
  @RequireFeature(FeatureKey.STORE_CLONING)
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get clone job history for a store' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of jobs to return',
  })
  @ApiResponse({ status: 200, description: 'Clone jobs retrieved' })
  async getCloneJobs(
    @Param('storeId') storeId: string,
    @Query('limit') limit?: number,
  ) {
    return this.cloneService.getCloneJobs(storeId, limit ? Number(limit) : 20);
  }

  @Get('clone/jobs/:jobId')
  @RequireFeature(FeatureKey.STORE_CLONING)
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get a specific clone job' })
  @ApiParam({ name: 'jobId', description: 'Clone job ID' })
  @ApiResponse({ status: 200, description: 'Clone job retrieved' })
  @ApiResponse({ status: 404, description: 'Clone job not found' })
  async getCloneJob(@Param('jobId') jobId: string) {
    return this.cloneService.getCloneJob(jobId);
  }

  @Post('clone/jobs/:jobId/rollback')
  @RequireFeature(FeatureKey.STORE_CLONING)
  @Permissions('store.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rollback a failed clone job' })
  @ApiParam({ name: 'jobId', description: 'Clone job ID' })
  @ApiResponse({ status: 200, description: 'Clone job rolled back' })
  @ApiResponse({ status: 400, description: 'Can only rollback failed jobs' })
  @ApiResponse({ status: 404, description: 'Clone job not found' })
  async rollbackCloneJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: any,
  ) {
    return this.cloneService.rollbackCloneJob(jobId, user.id);
  }
}

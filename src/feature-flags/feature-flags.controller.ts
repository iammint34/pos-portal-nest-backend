import {
  Controller,
  Get,
  Put,
  Param,
  Body,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FeatureFlagsService } from './feature-flags.service';
import { UpdateFeatureFlagDto, BulkUpdateFeaturesDto } from './dto';
import { FeatureKey } from './feature-flags.constants';

@ApiTags('Feature Flags')
@ApiBearerAuth()
@Controller('api/v1/stores/:storeId/features')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get all feature flags for a store' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Feature flags retrieved' })
  async getStoreFeatures(@Param('storeId') storeId: string) {
    return this.featureFlagsService.getStoreFeatures(storeId);
  }

  @Get(':featureKey')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get a specific feature flag' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({
    name: 'featureKey',
    enum: FeatureKey,
    description: 'Feature key',
  })
  @ApiResponse({ status: 200, description: 'Feature flag retrieved' })
  async getStoreFeature(
    @Param('storeId') storeId: string,
    @Param('featureKey') featureKey: FeatureKey,
  ) {
    return this.featureFlagsService.getStoreFeature(storeId, featureKey);
  }

  @Put(':featureKey')
  @Permissions('store.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a feature flag' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({
    name: 'featureKey',
    enum: FeatureKey,
    description: 'Feature key',
  })
  @ApiResponse({ status: 200, description: 'Feature flag updated' })
  async updateFeatureFlag(
    @Param('storeId') storeId: string,
    @Param('featureKey') featureKey: FeatureKey,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() user: any,
  ) {
    return this.featureFlagsService.updateFeatureFlag(
      storeId,
      featureKey,
      dto,
      user?.id,
    );
  }

  @Put()
  @Permissions('store.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk update feature flags' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Feature flags updated' })
  async bulkUpdateFeatureFlags(
    @Param('storeId') storeId: string,
    @Body() dto: BulkUpdateFeaturesDto,
    @CurrentUser() user: any,
  ) {
    return this.featureFlagsService.bulkUpdateFeatureFlags(
      storeId,
      dto.features,
      user?.id,
    );
  }
}

// Admin-only controller for system-wide feature management
@ApiTags('Feature Flags (Admin)')
@ApiBearerAuth()
@Controller('api/v1/admin/features')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FeatureFlagsAdminController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get('stats')
  @Permissions('system.admin')
  @ApiOperation({ summary: 'Get feature usage statistics across all stores' })
  @ApiResponse({ status: 200, description: 'Feature statistics retrieved' })
  async getFeatureStats() {
    return this.featureFlagsService.getFeatureStats();
  }
}

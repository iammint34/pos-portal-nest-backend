import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import {
  FeatureKey,
  FEATURE_DESCRIPTIONS,
} from '../../feature-flags/feature-flags.constants';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeatures = this.reflector.getAllAndOverride<FeatureKey[]>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no features required, allow access
    if (!requiredFeatures || requiredFeatures.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const storeId = request.user?.storeId || request.params?.storeId;

    if (!storeId) {
      throw new ForbiddenException('Store ID required for feature access');
    }

    // Check if all required features are enabled
    const allEnabled = await this.featureFlagsService.areAllEnabled(
      storeId,
      requiredFeatures,
    );

    if (!allEnabled) {
      const featureNames = requiredFeatures
        .map((f) => FEATURE_DESCRIPTIONS[f] || f)
        .join(', ');

      throw new ForbiddenException(
        `This feature is not enabled for your store. Required features: ${featureNames}`,
      );
    }

    return true;
  }
}

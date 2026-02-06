import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from '../../feature-flags/feature-flags.constants';

export const FEATURE_FLAG_KEY = 'requiredFeatures';

/**
 * Decorator to require one or more feature flags to be enabled
 * Usage: @RequireFeature(FeatureKey.LOSS_PREVENTION)
 * or: @RequireFeature(FeatureKey.LOSS_PREVENTION, FeatureKey.NOTIFICATIONS)
 */
export const RequireFeature = (...features: FeatureKey[]) =>
  SetMetadata(FEATURE_FLAG_KEY, features);

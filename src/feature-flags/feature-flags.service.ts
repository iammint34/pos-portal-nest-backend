import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureKey, FEATURE_DESCRIPTIONS } from './feature-flags.constants';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';

// Type for StoreFeature until Prisma client is regenerated
interface StoreFeature {
  id: string;
  storeId: string;
  featureKey: string;
  enabled: boolean;
  config: any;
  enabledAt: Date | null;
  enabledBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class FeatureFlagsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if a feature is enabled for a store
   */
  async isEnabled(storeId: string, featureKey: FeatureKey): Promise<boolean> {
    try {
      const feature = await (this.prisma as any).storeFeature.findUnique({
        where: {
          storeId_featureKey: {
            storeId,
            featureKey: featureKey,
          },
        },
      });

      return feature?.enabled ?? false;
    } catch {
      // If the table doesn't exist yet, return false
      return false;
    }
  }

  /**
   * Check if multiple features are enabled for a store
   * Returns true only if ALL features are enabled
   */
  async areAllEnabled(
    storeId: string,
    featureKeys: FeatureKey[],
  ): Promise<boolean> {
    try {
      const features = await (this.prisma as any).storeFeature.findMany({
        where: {
          storeId,
          featureKey: { in: featureKeys },
          enabled: true,
        },
      });

      return features.length === featureKeys.length;
    } catch {
      return false;
    }
  }

  /**
   * Check if any of the features are enabled for a store
   */
  async isAnyEnabled(
    storeId: string,
    featureKeys: FeatureKey[],
  ): Promise<boolean> {
    try {
      const feature = await (this.prisma as any).storeFeature.findFirst({
        where: {
          storeId,
          featureKey: { in: featureKeys },
          enabled: true,
        },
      });

      return !!feature;
    } catch {
      return false;
    }
  }

  /**
   * Get all feature flags for a store
   */
  async getStoreFeatures(storeId: string) {
    // Get existing features
    const existingFeatures: StoreFeature[] = await (
      this.prisma as any
    ).storeFeature.findMany({
      where: { storeId },
    });

    // Map all feature keys with their status
    const featureMap = new Map<string, StoreFeature>(
      existingFeatures.map((f) => [f.featureKey, f]),
    );

    return Object.values(FeatureKey).map((key) => {
      const existing = featureMap.get(key);
      return {
        featureKey: key,
        description: FEATURE_DESCRIPTIONS[key],
        enabled: existing?.enabled ?? false,
        config: existing?.config ?? null,
        enabledAt: existing?.enabledAt ?? null,
        enabledBy: existing?.enabledBy ?? null,
      };
    });
  }

  /**
   * Get a specific feature flag for a store
   */
  async getStoreFeature(storeId: string, featureKey: FeatureKey) {
    const feature: StoreFeature | null = await (
      this.prisma as any
    ).storeFeature.findUnique({
      where: {
        storeId_featureKey: {
          storeId,
          featureKey: featureKey,
        },
      },
    });

    return {
      featureKey,
      description: FEATURE_DESCRIPTIONS[featureKey],
      enabled: feature?.enabled ?? false,
      config: feature?.config ?? null,
      enabledAt: feature?.enabledAt ?? null,
      enabledBy: feature?.enabledBy ?? null,
    };
  }

  /**
   * Update a feature flag for a store
   */
  async updateFeatureFlag(
    storeId: string,
    featureKey: FeatureKey,
    dto: UpdateFeatureFlagDto,
    userId?: string,
  ) {
    // Verify store exists
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const feature: StoreFeature = await (
      this.prisma as any
    ).storeFeature.upsert({
      where: {
        storeId_featureKey: {
          storeId,
          featureKey: featureKey,
        },
      },
      update: {
        enabled: dto.enabled,
        config: dto.config ?? undefined,
        enabledAt: dto.enabled ? new Date() : null,
        enabledBy: dto.enabled ? userId : null,
      },
      create: {
        storeId,
        featureKey: featureKey,
        enabled: dto.enabled,
        config: dto.config ?? undefined,
        enabledAt: dto.enabled ? new Date() : null,
        enabledBy: dto.enabled ? userId : null,
      },
    });

    return {
      featureKey,
      description: FEATURE_DESCRIPTIONS[featureKey],
      enabled: feature.enabled,
      config: feature.config,
      enabledAt: feature.enabledAt,
      enabledBy: feature.enabledBy,
    };
  }

  /**
   * Bulk update feature flags for a store
   */
  async bulkUpdateFeatureFlags(
    storeId: string,
    features: { featureKey: FeatureKey; enabled: boolean }[],
    userId?: string,
  ) {
    const results = await Promise.all(
      features.map((f) =>
        this.updateFeatureFlag(
          storeId,
          f.featureKey,
          { enabled: f.enabled },
          userId,
        ),
      ),
    );

    return results;
  }

  /**
   * Initialize default feature flags for a new store (all disabled)
   */
  async initializeStoreFeatures(storeId: string) {
    const featureKeys = Object.values(FeatureKey);

    await (this.prisma as any).storeFeature.createMany({
      data: featureKeys.map((key) => ({
        storeId,
        featureKey: key,
        enabled: false,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Get feature usage statistics across all stores
   */
  async getFeatureStats() {
    const stats = await (this.prisma as any).storeFeature.groupBy({
      by: ['featureKey', 'enabled'],
      _count: true,
    });

    const result: Record<string, { enabled: number; disabled: number }> = {};

    for (const key of Object.values(FeatureKey)) {
      result[key] = { enabled: 0, disabled: 0 };
    }

    for (const stat of stats) {
      const key = stat.featureKey as string;
      if (result[key]) {
        if (stat.enabled) {
          result[key].enabled = stat._count;
        } else {
          result[key].disabled = stat._count;
        }
      }
    }

    return Object.entries(result).map(([featureKey, counts]) => ({
      featureKey,
      description: FEATURE_DESCRIPTIONS[featureKey as FeatureKey],
      ...counts,
    }));
  }
}

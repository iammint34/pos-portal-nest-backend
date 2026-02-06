import { IsArray, IsBoolean, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { FeatureKey } from '../feature-flags.constants';

class FeatureFlagItem {
  @ApiProperty({ enum: FeatureKey, description: 'Feature key' })
  @IsEnum(FeatureKey)
  featureKey: FeatureKey;

  @ApiProperty({ description: 'Enable or disable the feature' })
  @IsBoolean()
  enabled: boolean;
}

export class BulkUpdateFeaturesDto {
  @ApiProperty({
    type: [FeatureFlagItem],
    description: 'List of features to update',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeatureFlagItem)
  features: FeatureFlagItem[];
}

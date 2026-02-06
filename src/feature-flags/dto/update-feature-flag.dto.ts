import { IsBoolean, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFeatureFlagDto {
  @ApiProperty({ description: 'Enable or disable the feature' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Feature-specific configuration' })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

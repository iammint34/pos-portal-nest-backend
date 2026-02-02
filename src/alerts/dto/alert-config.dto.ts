import { IsOptional, IsBoolean, IsNumber, IsObject, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAlertConfigDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    example: { noSalesHours: 4, businessStartHour: 8, businessEndHour: 22 },
  })
  @IsOptional()
  @IsObject()
  thresholds?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  cooldownMinutes?: number;
}

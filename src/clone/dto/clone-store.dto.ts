import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CloneStoreConfigDto {
  @ApiPropertyOptional({ description: 'Clone items', default: true })
  @IsOptional()
  @IsBoolean()
  items?: boolean = true;

  @ApiPropertyOptional({ description: 'Clone categories', default: true })
  @IsOptional()
  @IsBoolean()
  categories?: boolean = true;

  @ApiPropertyOptional({
    description: 'Clone roles and permissions',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  roles?: boolean = true;

  @ApiPropertyOptional({
    description: 'Clone loss prevention thresholds',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  lossPreventionThresholds?: boolean = true;

}

export enum StoreType {
  RESTAURANT = 'RESTAURANT',
  RETAIL = 'RETAIL',
  CAFE = 'CAFE',
  OTHER = 'OTHER',
}

export class CloneStoreDto {
  @ApiProperty({ description: 'Source store ID to clone from' })
  @IsString()
  sourceStoreId: string;

  @ApiProperty({
    description: 'Name for the new store',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Store type', enum: StoreType })
  @IsOptional()
  @IsEnum(StoreType)
  type?: StoreType;

  @ApiPropertyOptional({ description: 'Address of the new store' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Phone number of the new store' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email of the new store' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Clone configuration options' })
  @IsOptional()
  @IsObject()
  config?: CloneStoreConfigDto;

  // BIR Compliance fields
  @ApiPropertyOptional({ description: 'BIR registered business name' })
  @IsOptional()
  @IsString()
  registeredName?: string;

  @ApiPropertyOptional({ description: 'BIR registered address' })
  @IsOptional()
  @IsString()
  registeredAddress?: string;

  @ApiPropertyOptional({ description: 'VAT TIN' })
  @IsOptional()
  @IsString()
  vatTin?: string;

  @ApiPropertyOptional({ description: 'Is VAT registered', default: true })
  @IsOptional()
  @IsBoolean()
  isVatRegistered?: boolean = true;
}

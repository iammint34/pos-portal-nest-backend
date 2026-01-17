import { IsNotEmpty, IsString, IsOptional, IsEnum, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoreType, StoreStatus } from '@prisma/client';

export class CreateStoreDto {
  @ApiProperty({ example: 'My Restaurant' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: StoreType, default: StoreType.OTHER })
  @IsOptional()
  @IsEnum(StoreType)
  type?: StoreType;

  @ApiPropertyOptional({ example: '123 Main Street, City' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'store@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateStoreDto {
  @ApiPropertyOptional({ example: 'Updated Restaurant Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: StoreType })
  @IsOptional()
  @IsEnum(StoreType)
  type?: StoreType;

  @ApiPropertyOptional({ enum: StoreStatus })
  @IsOptional()
  @IsEnum(StoreStatus)
  status?: StoreStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}

import { IsNotEmpty, IsString, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiPropertyOptional({ description: 'Store ID (required for owner users without storeId)' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiProperty({ example: 'Manager' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Store manager with full access' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ['store.read', 'item.create'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Senior Manager' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ['store.read', 'item.create', 'item.update'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BranchStatus } from '@prisma/client';

export class CreateBranchDto {
  @ApiPropertyOptional({
    example: 'store-uuid',
    description: 'Store ID (required for owners, ignored for store users)',
  })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiProperty({ example: 'Main Branch' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '456 Branch Street, City' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  // BIR PTU (Permit To Use) Compliance Fields
  @ApiPropertyOptional({
    example: 'PTU-2024-000001',
    description: 'PTU Number from BIR',
  })
  @IsOptional()
  @IsString()
  ptuNo?: string;

  @ApiPropertyOptional({
    example: '2024-01-15',
    description: 'PTU Date Issued',
  })
  @IsOptional()
  @IsDateString()
  ptuDateIssued?: string;

  @ApiPropertyOptional({
    example: '2029-01-15',
    description: 'PTU Valid Until',
  })
  @IsOptional()
  @IsDateString()
  ptuValidUntil?: string;

  @ApiPropertyOptional({
    example: 'ACC-2024-000001',
    description: 'BIR Accreditation Number',
  })
  @IsOptional()
  @IsString()
  accreditationNo?: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: 'Updated Branch Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: BranchStatus })
  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  // BIR PTU (Permit To Use) Compliance Fields
  @ApiPropertyOptional({
    example: 'PTU-2024-000001',
    description: 'PTU Number from BIR',
  })
  @IsOptional()
  @IsString()
  ptuNo?: string;

  @ApiPropertyOptional({
    example: '2024-01-15',
    description: 'PTU Date Issued',
  })
  @IsOptional()
  @IsDateString()
  ptuDateIssued?: string;

  @ApiPropertyOptional({
    example: '2029-01-15',
    description: 'PTU Valid Until',
  })
  @IsOptional()
  @IsDateString()
  ptuValidUntil?: string;

  @ApiPropertyOptional({
    example: 'ACC-2024-000001',
    description: 'BIR Accreditation Number',
  })
  @IsOptional()
  @IsString()
  accreditationNo?: string;
}

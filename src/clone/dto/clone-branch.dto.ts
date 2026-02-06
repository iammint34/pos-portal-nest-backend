import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CloneBranchConfigDto {
  @ApiPropertyOptional({
    description: 'Clone item availability settings',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  itemBranches?: boolean = true;
}

export class CloneBranchDto {
  @ApiProperty({ description: 'Source branch ID to clone from' })
  @IsString()
  sourceBranchId: string;

  @ApiProperty({
    description: 'Name for the new branch',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Address of the new branch' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Phone number of the new branch' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Clone configuration options' })
  @IsOptional()
  @IsObject()
  config?: CloneBranchConfigDto;

  // BIR Compliance fields (optional, usually set later)
  @ApiPropertyOptional({ description: 'PTU Number' })
  @IsOptional()
  @IsString()
  ptuNo?: string;

  @ApiPropertyOptional({ description: 'Accreditation Number' })
  @IsOptional()
  @IsString()
  accreditationNo?: string;
}

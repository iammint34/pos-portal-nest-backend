import { IsNotEmpty, IsString, IsOptional, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new POS device from Portal (generates registration code)
 */
export class CreatePosDeviceDto {
  @ApiProperty({ description: 'Branch ID where the device will be assigned' })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiPropertyOptional({ example: 'Cashier 1', description: 'Friendly name for the device' })
  @IsOptional()
  @IsString()
  name?: string;
}

/**
 * DTO for registering a POS device using registration code (from POS device)
 */
export class RegisterWithCodeDto {
  @ApiProperty({ example: 'ABCD-1234', description: 'Registration code from Portal' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/, { message: 'Invalid registration code format' })
  registrationCode: string;

  @ApiProperty({ example: 'POS-001-ABC123', description: 'Unique device identifier' })
  @IsString()
  @IsNotEmpty()
  deviceIdentifier: string;

  @ApiPropertyOptional({ example: 'Counter 1', description: 'Device name (optional, overrides Portal name)' })
  @IsOptional()
  @IsString()
  deviceName?: string;
}

/**
 * Response DTO for registration with code
 */
export class RegisterWithCodeResponseDto {
  @ApiProperty()
  deviceToken: string;

  @ApiProperty()
  tokenExpiresAt: Date;

  @ApiProperty()
  storeId: string;

  @ApiProperty()
  storeName: string;

  @ApiProperty()
  branchId: string;

  @ApiProperty()
  branchName: string;

  @ApiProperty()
  deviceId: string;

  @ApiProperty()
  deviceName: string;
}

/**
 * Legacy DTO for direct device registration
 */
export class RegisterPosDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ example: 'POS-001-ABC123' })
  @IsString()
  @IsNotEmpty()
  deviceIdentifier: string;

  @ApiPropertyOptional({ example: 'Cashier 1' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  appVersion?: string;
}

export class UpdatePosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class PosAuthDto {
  @ApiProperty({ example: 'POS-001-ABC123' })
  @IsString()
  @IsNotEmpty()
  deviceIdentifier: string;
}

export class PosAuthResponseDto {
  @ApiProperty()
  deviceToken: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  posDevice: {
    id: string;
    branchId: string;
    name: string;
  };
}

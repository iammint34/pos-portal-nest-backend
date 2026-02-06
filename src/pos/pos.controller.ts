import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PosService } from './pos.service';
import {
  RegisterPosDto,
  UpdatePosDto,
  PosAuthDto,
  CreatePosDeviceDto,
  RegisterWithCodeDto,
} from './dto';
import {
  Permissions,
  CurrentUser,
  CurrentUserData,
  Public,
} from '../common/decorators';

@ApiTags('pos')
@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  // ========== Device Registration & Auth ==========

  @Post('devices')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pos.manage')
  @ApiOperation({ summary: 'Create a new POS device with registration code' })
  createDevice(
    @Body() createDto: CreatePosDeviceDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.posService.createDevice(createDto, user.userId);
  }

  @Public()
  @Post('register-with-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Register POS device using registration code (called from POS device)',
  })
  registerWithCode(@Body() registerDto: RegisterWithCodeDto) {
    return this.posService.registerWithCode(registerDto);
  }

  @Post('devices/:id/regenerate-code')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pos.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Regenerate registration code for an unregistered device',
  })
  regenerateCode(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.posService.regenerateCode(id, user?.storeId, user.userId);
  }

  @Post('register')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pos.manage')
  @ApiOperation({
    summary: 'Register a new POS device (legacy - direct registration)',
  })
  register(
    @Body() registerPosDto: RegisterPosDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.posService.register(registerPosDto, user.userId);
  }

  @Public()
  @Post('authenticate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate POS device and get token' })
  authenticate(@Body() posAuthDto: PosAuthDto) {
    return this.posService.authenticate(posAuthDto.deviceIdentifier);
  }

  // ========== Device Management ==========

  @Get('devices')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pos.read')
  @ApiOperation({
    summary:
      'Get all POS devices. If user has storeId, filters by store. Owners can see all or filter by storeId query param.',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filter by store ID (owners only)',
  })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const effectiveStoreId = storeId || user?.storeId;
    return this.posService.findAll(effectiveStoreId, {
      branchId,
      status,
      page,
      limit,
    });
  }

  @Get('devices/stats')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pos.read')
  @ApiOperation({
    summary:
      'Get POS device statistics. If user has storeId, filters by store. Owners can see all or filter by storeId query param.',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filter by store ID (owners only)',
  })
  getStats(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
  ) {
    const effectiveStoreId = storeId || user?.storeId;
    return this.posService.getDeviceStats(effectiveStoreId);
  }

  @Get('devices/:id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get POS device by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.posService.findOne(id, user?.storeId);
  }

  @Patch('devices/:id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pos.manage')
  @ApiOperation({ summary: 'Update POS device' })
  update(
    @Param('id') id: string,
    @Body() updatePosDto: UpdatePosDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.posService.update(id, updatePosDto, user?.storeId, user.userId);
  }

  @Delete('devices/:id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pos.manage')
  @ApiOperation({ summary: 'Delete POS device' })
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.posService.remove(id, user?.storeId, user.userId);
  }

  @Post('devices/:id/deactivate')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pos.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate POS device and revoke token' })
  deactivate(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.posService.deactivate(id, user?.storeId);
  }
}

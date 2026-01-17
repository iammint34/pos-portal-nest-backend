import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CreateStoreDto, UpdateStoreDto } from './dto';
import { Permissions, CurrentUser, CurrentUserData } from '../common/decorators';

@ApiTags('stores')
@Controller('stores')
@ApiBearerAuth('JWT-auth')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  @Permissions('store.create')
  @ApiOperation({ summary: 'Create a new store' })
  create(
    @Body() createStoreDto: CreateStoreDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.storesService.create(createStoreDto, user.userId);
  }

  @Get()
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get all stores' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.storesService.findAll(page, limit);
  }

  @Get('my-stores')
  @ApiOperation({ summary: 'Get stores accessible by current user' })
  findMyStores(@CurrentUser() user: CurrentUserData) {
    return this.storesService.findByUser(user.userId);
  }

  @Get(':id')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get store by ID' })
  findOne(@Param('id') id: string) {
    return this.storesService.findOne(id);
  }

  @Get(':id/stats')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get store statistics' })
  getStats(@Param('id') id: string) {
    return this.storesService.getStoreStats(id);
  }

  @Patch(':id')
  @Permissions('store.update')
  @ApiOperation({ summary: 'Update store' })
  update(
    @Param('id') id: string,
    @Body() updateStoreDto: UpdateStoreDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.storesService.update(id, updateStoreDto, user.userId);
  }

  @Delete(':id')
  @Permissions('store.delete')
  @ApiOperation({ summary: 'Delete store' })
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.storesService.remove(id, user.userId);
  }
}

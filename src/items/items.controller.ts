import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ItemsService } from './items.service';
import {
  CreateItemDto,
  UpdateItemDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  ItemBranchAvailabilityDto,
} from './dto';
import {
  Permissions,
  CurrentUser,
  CurrentUserData,
} from '../common/decorators';

@ApiTags('items')
@Controller('items')
@ApiBearerAuth('JWT-auth')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  // ========== Items ==========

  @Post()
  @Permissions('item.create')
  @ApiOperation({ summary: 'Create a new item' })
  createItem(
    @Body() createItemDto: CreateItemDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    // If storeId not provided in DTO, use current user's store
    if (!createItemDto.storeId && user?.storeId) {
      createItemDto.storeId = user.storeId;
    }
    if (!createItemDto.storeId) {
      throw new BadRequestException('Store ID is required');
    }
    return this.itemsService.createItem(createItemDto.storeId, createItemDto, user.userId);
  }

  @Get()
  @Permissions('item.read')
  @ApiOperation({
    summary:
      'Get all items. If user has storeId, filters by store. Owners can see all or filter by storeId query param.',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filter by store ID (owners only)',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAllItems(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('categoryId') categoryId?: string,
    @Query('isActive') isActive?: boolean,
    @Query('search') search?: string,
  ) {
    const effectiveStoreId = storeId || user?.storeId;
    console.log('Effective Store ID:', effectiveStoreId);
    return this.itemsService.findAllItems(effectiveStoreId, {
      page,
      limit,
      categoryId,
      isActive,
      search,
    });
  }

  @Get(':id')
  @Permissions('item.read')
  @ApiOperation({ summary: 'Get item by ID' })
  findOneItem(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.itemsService.findOneItem(id, user?.storeId);
  }

  @Get(':id/versions')
  @Permissions('item.read')
  @ApiOperation({ summary: 'Get item version history' })
  getItemVersions(@Param('id') id: string) {
    return this.itemsService.getItemVersions(id);
  }

  @Patch(':id')
  @Permissions('item.update')
  @ApiOperation({ summary: 'Update item' })
  updateItem(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.itemsService.updateItem(
      id,
      updateItemDto,
      user?.storeId,
      user.userId,
    );
  }

  @Delete(':id')
  @Permissions('item.delete')
  @ApiOperation({ summary: 'Delete item' })
  removeItem(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.itemsService.removeItem(id, user?.storeId, user.userId);
  }

  // ========== Branch Availability ==========

  @Post(':id/availability')
  @Permissions('item.update')
  @ApiOperation({ summary: 'Set item availability for a branch' })
  setItemBranchAvailability(
    @Param('id') itemId: string,
    @Body() availability: ItemBranchAvailabilityDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.itemsService.setItemBranchAvailability(
      itemId,
      availability,
      user?.storeId,
    );
  }

  @Post(':id/availability/bulk')
  @Permissions('item.update')
  @ApiOperation({ summary: 'Set item availability for multiple branches' })
  bulkSetBranchAvailability(
    @Param('id') itemId: string,
    @Body() availabilities: ItemBranchAvailabilityDto[],
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.itemsService.bulkSetBranchAvailability(
      itemId,
      availabilities,
      user?.storeId,
    );
  }

  // ========== Categories ==========

  @Post('categories')
  @Permissions('item.create')
  @ApiOperation({ summary: 'Create a new category' })
  createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    // If storeId not provided in DTO, use current user's store
    if (!createCategoryDto.storeId && user?.storeId) {
      createCategoryDto.storeId = user.storeId;
    }
    if (!createCategoryDto.storeId) {
      throw new BadRequestException('Store ID is required');
    }
    return this.itemsService.createCategory(
      createCategoryDto.storeId,
      createCategoryDto,
      user.userId,
    );
  }

  @Get('categories/list')
  @Permissions('item.read')
  @ApiOperation({
    summary:
      'Get all categories. If user has storeId, filters by store. Owners can see all or filter by storeId query param.',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filter by store ID (owners only)',
  })
  findAllCategories(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
  ) {
    const effectiveStoreId = storeId || user?.storeId;
    return this.itemsService.findAllCategories(effectiveStoreId);
  }

  @Get('categories/:id')
  @Permissions('item.read')
  @ApiOperation({ summary: 'Get category by ID' })
  findOneCategory(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.itemsService.findOneCategory(id, user?.storeId);
  }

  @Patch('categories/:id')
  @Permissions('item.update')
  @ApiOperation({ summary: 'Update category' })
  updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.itemsService.updateCategory(
      id,
      updateCategoryDto,
      user?.storeId,
      user.userId,
    );
  }

  @Delete('categories/:id')
  @Permissions('item.delete')
  @ApiOperation({ summary: 'Delete category' })
  removeCategory(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.itemsService.removeCategory(id, user?.storeId, user.userId);
  }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { ListMarketplaceDto, SellerPageDto } from './dto/list-marketplace.dto.js';
import { MarketplaceService } from './marketplace.service.js';

@ApiTags('marketplace')
@Public()
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('listings')
  @ApiOperation({ summary: 'Approved listings with search, filters, sorting and pagination' })
  list(@Query() query: ListMarketplaceDto) {
    return this.marketplace.list(query);
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Public product projection for one approved listing' })
  detail(@Param('id') id: string) {
    return this.marketplace.detail(id);
  }

  @Get('sellers/:name')
  @ApiOperation({ summary: 'Public seller profile with their approved listings' })
  seller(@Param('name') name: string, @Query() query: SellerPageDto) {
    return this.marketplace.seller(name, query.page, query.pageSize);
  }
}

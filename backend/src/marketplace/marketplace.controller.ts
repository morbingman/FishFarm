import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { ListMarketplaceDto } from './dto/list-marketplace.dto.js';
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

  @Get('store')
  @ApiOperation({ summary: 'The company store profile: about, rating and catalog summary' })
  store() {
    return this.marketplace.store();
  }
}

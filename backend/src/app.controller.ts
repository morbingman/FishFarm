import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator.js';
import { AppService } from './app.service.js';

@ApiTags('meta')
@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API metadata' })
  getInfo() {
    return this.appService.getInfo();
  }
}

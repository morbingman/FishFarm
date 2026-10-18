import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'FishFarm API',
      version: '1.0.0',
      docs: '/docs',
      health: '/health',
    };
  }
}

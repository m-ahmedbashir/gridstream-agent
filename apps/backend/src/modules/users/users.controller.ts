import { Controller, Get, Put, Body, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('settings')
  async getSettings(@Query('userId') userId: string) {
    return this.usersService.getSettings(userId);
  }

  @Put('settings')
  async updateSettings(
    @Query('userId') userId: string,
    @Body() body: { extractionMode: string },
  ) {
    return this.usersService.updateSettings(userId, body.extractionMode);
  }
}

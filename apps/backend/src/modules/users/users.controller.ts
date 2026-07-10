import { Controller, Get, Put, Body, Query } from '@nestjs/common';
import { UsersService, type SettingsUpdate } from './users.service';

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
    @Body() body: SettingsUpdate,
  ) {
    return this.usersService.updateSettings(userId, body);
  }
}

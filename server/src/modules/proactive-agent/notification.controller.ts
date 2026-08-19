import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { NotificationService } from './notification.service'
import { NotificationPreferenceService } from './notification-preference.service'
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto'

@Controller()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: NotificationPreferenceService
  ) {}

  @Get('notification-preferences/global')
  getGlobalPreference() {
    return this.preferenceService.getGlobal()
  }

  @Patch('notification-preferences/global')
  updateGlobalPreference(@Body() dto: UpdateNotificationPreferenceDto) {
    return this.preferenceService.updateGlobal(dto)
  }

  @Get('notification-preferences/characters/:characterId')
  getCharacterPreference(@Param('characterId') characterId: string) {
    return this.preferenceService.getCharacterSettings(characterId)
  }

  @Patch('notification-preferences/characters/:characterId')
  updateCharacterPreference(@Param('characterId') characterId: string, @Body() dto: UpdateNotificationPreferenceDto) {
    return this.preferenceService.updateCharacterOverride(characterId, dto)
  }

  @Delete('notification-preferences/characters/:characterId')
  deleteCharacterPreference(@Param('characterId') characterId: string) {
    return this.preferenceService.deleteCharacterOverride(characterId)
  }

  @Get('notifications/unread')
  async findUnreadForSystem() {
    const notifications = await this.notificationService.findUnreadForSystem()
    const allowed = await Promise.all(notifications.map(async (notification) => {
      const preference = await this.preferenceService.resolve(notification.character_id)
      return preference.enabled && preference.systemEnabled ? notification : null
    }))
    return allowed.filter((notification): notification is NonNullable<typeof notification> => notification !== null)
  }

  @Get('notifications/:characterId')
  findByCharacter(@Param('characterId') characterId: string, @Query('unreadOnly') unreadOnly?: string) {
    return this.notificationService.findByCharacter(characterId, unreadOnly === 'true')
  }

  @Get('notifications/:id/context')
  getContext(@Param('id') id: string) {
    return this.notificationService.getContext(id)
  }

  @Patch('notifications/:id/read')
  markRead(@Param('id') id: string) {
    return this.notificationService.markRead(id)
  }

  @Patch('notifications/:id/system-delivered')
  markSystemDelivered(@Param('id') id: string) {
    return this.notificationService.markSystemDelivered(id)
  }

  @Post('notifications/:id/snooze')
  snooze(@Param('id') id: string, @Body('mode') mode: 'one_hour' | 'tomorrow_morning') {
    return this.notificationService.snooze(id, mode)
  }

  @Post('notifications/:id/dismiss')
  dismiss(@Param('id') id: string) {
    return this.notificationService.dismiss(id)
  }
}

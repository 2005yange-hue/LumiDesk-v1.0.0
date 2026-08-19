import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UpdateEmotionPreferenceDto } from './dto/update-emotion-preference.dto'
import { EmotionPreference } from './entities/emotion-preference.entity'

const DEFAULT_USER_ID = 'default'

@Injectable()
export class EmotionPreferenceService {
  constructor(
    @InjectRepository(EmotionPreference)
    private readonly preferenceRepo: Repository<EmotionPreference>
  ) {}

  async getPreference(): Promise<EmotionPreference> {
    const existing = await this.preferenceRepo.findOne({ where: { user_id: DEFAULT_USER_ID } })
    if (existing) return existing
    return this.preferenceRepo.save(this.preferenceRepo.create({ user_id: DEFAULT_USER_ID, enabled: true }))
  }

  async updatePreference(dto: UpdateEmotionPreferenceDto): Promise<EmotionPreference> {
    const preference = await this.getPreference()
    preference.enabled = dto.enabled
    return this.preferenceRepo.save(preference)
  }

  async isEnabled(): Promise<boolean> {
    return (await this.getPreference()).enabled
  }
}
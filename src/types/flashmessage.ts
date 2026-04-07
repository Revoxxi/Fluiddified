export interface AchievementToastPayload {
  id: string
  name: string
  description: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  points: number
  tierLabel?: string
  /** Vuetify icon alias (e.g. `$trophy`) from achievement definition */
  icon?: string
}

export interface FlashMessage {
  type?: FlashMessageTypes;
  open: boolean;
  text?: string;
  timeout?: number;
  achievement?: AchievementToastPayload;
}

export type FlashMessageTypes = 'success' | 'error' | 'warning' | 'primary' | 'secondary'

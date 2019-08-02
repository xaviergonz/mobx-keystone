import { computed } from "mobx"
import { Frozen, Model, model } from "../../dist"

// tiny
@model("Treasure")
export class Treasure extends Model<{ trapped: boolean; gold: number }> {
  defaultData = {
    gold: 0,
  }
}

// medium
export const HeroRoles = ["warrior", "wizard", "cleric", "thief"] as const
export type HeroRolesType = typeof HeroRoles[number]

@model("Hero")
export class Hero extends Model<{
  id: number
  name: string
  description: string
  level: number
  role: HeroRolesType
}> {
  defaultData = {
    level: 1,
  }

  @computed
  get descriptionLength() {
    return this.$.description.length
  }
}

// large
@model("Monster")
export class Monster extends Model<{
  id: string
  freestyle: Frozen<any>
  level: number
  maxHp: number
  hp: number
  warning?: string
  createdAt?: number
  treasures: Treasure[]
  eatenHeroes: Hero[]
  hasFangs: boolean
  hasClaws: boolean
  hasWings: boolean
  hasGrowl: boolean
  stenchLevel: number
  fearsFire: boolean
  fearsWater: boolean
  fearsWarriors: boolean
  fearsClerics: boolean
  fearsMages: boolean
  fearsThieves: boolean
  fearsProgrammers: boolean
}> {
  defaultData = {
    treasures: [],
    eatenHeroes: [],
    hasFangs: false,
    hasClaws: false,
    hasWings: false,
    hasGrowl: false,
    stenchLevel: 0,
    fearsFire: false,
    fearsWater: false,
    fearsWarriors: false,
    fearsClerics: false,
    fearsMages: false,
    fearsThieves: false,
    fearsProgrammers: true,
  }

  @computed
  get isAlive() {
    return this.$.hp > 0
  }

  @computed
  get isFlashingRed() {
    return this.$.hp > 0 && this.$.hp < this.$.maxHp && this.$.hp === 1
  }

  @computed
  get weight() {
    const victimWeight = this.$.eatenHeroes ? this.$.eatenHeroes.length : 0
    const fangWeight = this.$.hasFangs ? 10 : 5
    const wingWeight = this.$.hasWings ? 12 : 4
    return (victimWeight + fangWeight + wingWeight) * this.$.level > 5 ? 2 : 1
  }
}

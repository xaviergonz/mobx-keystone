import { computed } from "mobx"
import { Frozen, Model, model, prop } from "../.."

// tiny
@model("Treasure")
export class Treasure extends Model({
  trapped: prop<boolean>(),
  gold: prop(() => 0),
}) {}

// medium
export const HeroRoles = ["warrior", "wizard", "cleric", "thief"] as const
export type HeroRolesType = (typeof HeroRoles)[number]

@model("Hero")
export class Hero extends Model({
  id: prop<number>(),
  name: prop<string>(),
  description: prop<string>(),
  level: prop(() => 1),
  role: prop<HeroRolesType>(),
}) {
  @computed
  get descriptionLength() {
    return this.description.length
  }
}

// large
@model("Monster")
export class Monster extends Model({
  id: prop<string>(),
  freestyle: prop<Frozen<any>>(),
  level: prop<number>(),
  maxHp: prop<number>(),
  hp: prop<number>(),
  warning: prop<string | undefined>(),
  createdAt: prop<number | undefined>(),
  treasures: prop<Treasure[]>(() => []),
  eatenHeroes: prop<Hero[]>(() => []),
  hasFangs: prop<boolean>(() => false),
  hasClaws: prop<boolean>(() => false),
  hasWings: prop<boolean>(() => false),
  hasGrowl: prop<boolean>(() => false),
  stenchLevel: prop<number>(() => 0),
  fearsFire: prop<boolean>(() => false),
  fearsWater: prop<boolean>(() => false),
  fearsWarriors: prop<boolean>(() => false),
  fearsClerics: prop<boolean>(() => false),
  fearsMages: prop<boolean>(() => false),
  fearsThieves: prop<boolean>(() => false),
  fearsProgrammers: prop<boolean>(() => true),
}) {
  @computed
  get isAlive() {
    return this.hp > 0
  }

  @computed
  get isFlashingRed() {
    return this.hp > 0 && this.hp < this.maxHp && this.hp === 1
  }

  @computed
  get weight() {
    const victimWeight = this.eatenHeroes ? this.eatenHeroes.length : 0
    const fangWeight = this.hasFangs ? 10 : 5
    const wingWeight = this.hasWings ? 12 : 4
    return (victimWeight + fangWeight + wingWeight) * this.level > 5 ? 2 : 1
  }
}

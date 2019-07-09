import { modelSnapshotInWithMetadata, SnapshotInOf } from "../../dist"
import { Hero, HeroRoles, Monster, Treasure } from "./fixture-models"

/**
 * Creates data containing very few fields.
 *
 * @param count The number of items to create.
 */
export function createTreasure(count: number) {
  const data: SnapshotInOf<Treasure>[] = []
  let i = 0
  do {
    data.push(
      modelSnapshotInWithMetadata(Treasure, {
        trapped: i % 2 === 0,
        gold: ((count % 10) + 1) * 10,
      })
    )
    i++
  } while (i < count)
  return data
}

// why yes i DID graduate high school, why do you ask?
export const rando = () => (Math.random() > 0.5 ? 1 : 0)

const titles = ["Sir", "Lady", "Baron von", "Baroness", "Captain", "Dread", "Fancy"].sort(rando)
const givenNames = ["Abe", "Beth", "Chuck", "Dora", "Ernie", "Fran", "Gary", "Haily"].sort(rando)
const epicNames = ["Amazing", "Brauny", "Chafed", "Dapper", "Egomaniac", "Foul"].sort(rando)
const wtf = `Daenerys Stormborn of the House Targaryen, First of Her Name, the Unburnt,
    Queen of the Andals and the First Men, Khaleesi of the Great Grass Sea, Breaker of Chains,
    and Mother of Dragons. `
/**
 * Creates data with a medium number of fields and data.
 *
 * @param count The number of items to create.
 */
export function createHeros(count: number) {
  const data: SnapshotInOf<Hero>[] = []
  let i = 0
  let even = true
  let n1
  let n2
  let n3
  do {
    n1 = titles[i % titles.length]
    n2 = givenNames[i % givenNames.length]
    n3 = epicNames[i % epicNames.length]
    data.push(
      modelSnapshotInWithMetadata(
        Hero,
        {
          id: i,
          name: `${n1} ${n2} the ${n3}`,
          level: (count % 100) + 1,
          role: HeroRoles[i % HeroRoles.length],
          description: `${wtf} ${wtf} ${wtf}`,
        },
        "" + i
      )
    )
    even = !even
    i++
  } while (i < count)
  return data
}

/**
 * Creates data with a large number of fields and data.
 *
 * @param count The number of items to create.
 * @param treasureCount The number of small children to create.
 * @param heroCount The number of medium children to create.
 */
export function createMonsters(count: number, treasureCount: number, heroCount: number) {
  const data: SnapshotInOf<Monster>[] = []
  let i = 0
  let even = true
  do {
    const treasures = createTreasure(treasureCount)
    const eatenHeroes = createHeros(heroCount)
    data.push(
      modelSnapshotInWithMetadata(
        Monster,
        {
          id: `omg-${i}-run!`,
          freestyle: { $$frozen: true, data: `${wtf} ${wtf} ${wtf}${wtf} ${wtf} ${wtf}` },
          level: (count % 100) + 1,
          hp: i % 2 === 0 ? 1 : 5 * i,
          maxHp: 5 * i,
          warning: "!!!!!!",
          createdAt: Date.now(),
          hasFangs: even,
          hasClaws: even,
          hasWings: !even,
          hasGrowl: !even,
          fearsFire: even,
          fearsWater: !even,
          fearsWarriors: even,
          fearsClerics: !even,
          fearsMages: even,
          fearsThieves: !even,
          stenchLevel: i % 5,
          treasures,
          eatenHeroes,
        },
        `omg-${i}-run!`
      )
    )
    even = !even
    i++
  } while (i < count)
  return data
}

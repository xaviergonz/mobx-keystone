import { fromSnapshot } from "../dist"
import { createHeros, createMonsters, createTreasure } from "./fixtures/fixture-data"
import { Hero, Monster, Treasure } from "./fixtures/fixture-models"
import { start } from "./timer"

/**
 * Covers models with a trivial number of fields.
 *
 * @param count The number of records to create.
 */
export function smallScenario(count: number) {
  const data = createTreasure(count) // ready?
  const time = start()
  const converted = data.map(d => fromSnapshot<Treasure>(d)) // go
  const elapsed = time()
  const sanity = converted.length === count
  return { count, elapsed, sanity }
}
/**
 * Covers models with a moderate number of fields + 1 computed field.
 *
 * @param count The number of records to create.
 */
export function mediumScenario(count: number) {
  const data = createHeros(count) // ready?
  const time = start()
  const converted = data.map(d => fromSnapshot<Hero>(d)) // go
  const elapsed = time()
  const sanity = converted.length === count
  return { count, elapsed, sanity }
}
/**
 * Covers models with a large number of fields.
 *
 * @param count The number of records to create.
 * @param smallChildren The number of small children contained within.
 * @param mediumChildren The number of medium children contained within.
 */
export function largeScenario(count: number, smallChildren: number, mediumChildren: number) {
  const data = createMonsters(count, smallChildren, mediumChildren) // ready?
  const time = start()
  const converted = data.map(d => fromSnapshot<Monster>(d)) // go
  const elapsed = time()
  const sanity = converted.length === count
  return { count, elapsed, sanity }
}

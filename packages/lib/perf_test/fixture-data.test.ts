import { fromSnapshot } from "../../dist"
import { createHeros, createMonsters, createTreasure, rando } from "./fixtures/fixture-data"
import { Hero, Monster, Treasure } from "./fixtures/fixture-models"

test("createHeros", () => {
  const data = createHeros(10)
  expect(data.length).toBe(10)
  const hero = fromSnapshot<Hero>(data[0])
  expect(hero.descriptionLength > 1).toBe(true)
})

test("createMonsters", () => {
  const data = createMonsters(10, 10, 10)
  expect(data.length).toBe(10)
  expect(data[1].treasures!.length).toBe(10)
  expect(data[0].eatenHeroes!.length).toBe(10)
  const monster = fromSnapshot<Monster>(data[0])
  expect(monster.$.eatenHeroes && monster.$.eatenHeroes.length === 10).toBe(true)
  expect(monster.$.treasures.length === 10).toBe(true)
})

test("createTreasure", () => {
  const data = createTreasure(10)
  expect(data.length).toBe(10)
  const treasure = fromSnapshot<Treasure>(data[1])
  expect(treasure.$.gold > 0).toBe(true)
})

test("rando sorting", () => {
  // i'm going straight to hell for this test... must get coverage to 100%.... no matter the cost.
  let foundTrue = false
  let foundFalse = false
  let result
  do {
    result = rando()
    if (result) {
      foundTrue = true
    } else {
      foundFalse = true
    }
  } while (!foundTrue || !foundFalse)
  expect(foundTrue).toBe(true)
  expect(foundFalse).toBe(true)
})

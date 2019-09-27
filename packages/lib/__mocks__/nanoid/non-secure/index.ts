let id = 1

function generateId() {
  return `id-${id++}`
}

export default generateId

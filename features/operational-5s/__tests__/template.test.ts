import { describe, it, expect } from 'vitest'
import { official5sTemplate, getTemplateItemsByStage } from '../config/official5sTemplate'

describe('Official 5S Template', () => {
  it('should have exactly 21 items', () => {
    expect(official5sTemplate.length).toBe(21)
  })

  it('should have 7 items for ABERTURA', () => {
    const items = getTemplateItemsByStage('ABERTURA')
    expect(items.length).toBe(7)
  })

  it('should have 7 items for DURANTE_O_DIA', () => {
    const items = getTemplateItemsByStage('DURANTE_O_DIA')
    expect(items.length).toBe(7)
  })

  it('should have 7 items for FECHAMENTO', () => {
    const items = getTemplateItemsByStage('FECHAMENTO')
    expect(items.length).toBe(7)
  })

  it('all items should have unique ids', () => {
    const ids = official5sTemplate.map(item => item.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(21)
  })
})

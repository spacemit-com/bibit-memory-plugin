import { describe, expect, it } from 'vitest'
import { featureModule } from '../src/feature'
import { pluginLocales } from '../src/plugin'

describe('plugin entry', () => {
  it('exports the navigation locales the host preloads', () => {
    expect(pluginLocales).toBe(featureModule.locales)
    expect(pluginLocales?.['zh-CN']?.title).toBe('记忆')
    expect(pluginLocales?.en?.title).toBe('Memory')
  })
})

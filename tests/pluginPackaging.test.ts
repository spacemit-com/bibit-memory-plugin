import { describe, expect, it } from 'vitest'
import manifest from '../bibit.feature.json'
import packageJson from '../package.json'
import grants from '../deploy/feature-capability-grants-memory.json'
import rules from '../debian/rules?raw'
import changelog from '../debian/changelog?raw'

describe('plugin packaging', () => {
  it('declares exactly the grants the manifest requires', () => {
    expect(manifest.requiredHostCapabilities).toEqual([
      'service:memory',
      'file:transfer',
    ])
    expect(grants.features.memory).toEqual(manifest.requiredHostCapabilities)
    expect(grants.serviceOperations.memory.memory).toContain(
      'privacy.export_data'
    )
  })

  it('keeps the manifest version aligned with the package and debian metadata', () => {
    expect(packageJson.version).toBe(manifest.version)
    expect(rules).toContain(`PLUGIN_VERSION := ${manifest.version}`)
    expect(changelog.startsWith(`bibit-memory-plugin (${manifest.version})`)).toBe(
      true
    )
  })
})

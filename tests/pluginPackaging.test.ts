import { describe, expect, it } from 'vitest'
import manifest from '../bibit.feature.json'
import packageJson from '../package.json'
import grants from '../deploy/feature-capability-grants-memory.json'

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
    expect(grants.serviceOperations.memory.memory).toContain(
      'privacy.import_data'
    )
  })

  // Debian packaging is maintained separately and is not part of this public
  // source tree. Its release version may differ from the plugin version.
  it('keeps the manifest version aligned with the npm package', () => {
    expect(packageJson.version).toBe(manifest.version)
  })
})

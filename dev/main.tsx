import React from 'react'
import { createRoot } from 'react-dom/client'
import { FeatureDevHost } from '@bibit/feature-dev-host'
import '@bibit/feature-dev-host/styles.css'
import type { FeatureManifestV1 } from '@bibit/feature-contracts'
import manifestJson from '../bibit.feature.json'
import { featureModule } from '../src/feature'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <FeatureDevHost
      manifest={manifestJson as FeatureManifestV1}
      module={featureModule}
      serviceConnections={{
        memory: `http://${window.location.hostname}:5168/invoke`,
      }}
    />
  </React.StrictMode>
)

import { registerFeaturePlugin } from '@bibit/feature-plugin-sdk'
import type { FeatureManifestV1 } from '@bibit/feature-contracts'
import manifestJson from '../bibit.feature.json'
import { featureModule } from './feature'

registerFeaturePlugin({ manifest: manifestJson as FeatureManifestV1, module: featureModule })
// 宿主在导入插件包后读取顶层 pluginLocales 来注册导航文案
// （memory:title / memory:description），注册用的 module.locales 不参与这一步。
export const pluginLocales = featureModule.locales

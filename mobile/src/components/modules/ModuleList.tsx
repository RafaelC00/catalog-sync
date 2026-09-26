import React from 'react';
import { View } from 'react-native';
import type { PdpModule, BrandTheme } from '../../types/domain';
import type { Money } from '../../types/shopify';
import { CareAccordion } from './CareAccordion';
import { SizeGuideTable } from './SizeGuideTable';
import { BundleOffer } from './BundleOffer';

interface ModuleListProps {
  modules: PdpModule[];
  theme: BrandTheme;
  price: Money;
}

/**
 * Renders the metaobject-driven PDP modules in `display_order`, dispatching
 * to a genuinely different component per `module_type`. `modules` is
 * already sorted (see parsePdpModules); this just maps type -> component.
 * An empty array (no modules provisioned/assigned) renders nothing --
 * that's the graceful-degradation path, not an error.
 */
export function ModuleList({ modules, theme, price }: ModuleListProps) {
  if (modules.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 12 }}>
      {modules.map((module) => {
        switch (module.moduleType) {
          case 'care':
            return <CareAccordion key={module.id} module={module} theme={theme} />;
          case 'size_guide':
            return <SizeGuideTable key={module.id} module={module} theme={theme} />;
          case 'bundle':
            return <BundleOffer key={module.id} module={module} theme={theme} price={price} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

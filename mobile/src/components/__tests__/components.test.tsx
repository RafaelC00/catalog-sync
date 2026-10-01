import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmptyView, ErrorView } from '../StateViews';
import { SpecGrid } from '../pdp/SpecGrid';
import { ModuleList } from '../modules/ModuleList';
import { DEFAULT_THEME } from '../../theme/defaultTheme';

// The real reanimated/worklets runtime needs native modules that do not exist
// under Jest, so replace it with plain views and inert layout animations.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: { View }, FadeIn: {}, FadeOut: {} };
});

// ThemeContext pulls in api/env, which requires store env vars at import time.
jest.mock('../../theme/ThemeContext', () => ({
  useStoreTheme: () => ({ theme: jest.requireActual('../../theme/defaultTheme').DEFAULT_THEME }),
}));

describe('ErrorView', () => {
  it('shows the message and no retry control when no handler is given', async () => {
    await render(<ErrorView label="Something broke" />);
    expect(screen.getByText('Something broke')).toBeOnTheScreen();
    expect(screen.queryByText('Tap to retry')).not.toBeOnTheScreen();
  });

  it('calls onRetry when the retry control is pressed', async () => {
    const onRetry = jest.fn();
    await render(<ErrorView label="Something broke" onRetry={onRetry} />);
    await fireEvent.press(screen.getByText('Tap to retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyView', () => {
  it('renders the empty-state label', async () => {
    await render(<EmptyView label="No products yet" />);
    expect(screen.getByText('No products yet')).toBeOnTheScreen();
  });
});

describe('SpecGrid', () => {
  it('renders nothing for an empty pair list', async () => {
    await render(<SpecGrid pairs={[]} theme={DEFAULT_THEME} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('renders an uppercased label, its value, and the mapped emoji for each pair', async () => {
    await render(<SpecGrid pairs={[{ label: 'Weight', value: '180 GSM' }]} theme={DEFAULT_THEME} />);
    expect(screen.getByText('WEIGHT')).toBeOnTheScreen();
    expect(screen.getByText('180 GSM')).toBeOnTheScreen();
    expect(screen.getByText('⚖️')).toBeOnTheScreen();
  });

  it('uses the fallback emoji for a label with no mapping', async () => {
    await render(<SpecGrid pairs={[{ label: 'Customization', value: 'Embroidery' }]} theme={DEFAULT_THEME} />);
    expect(screen.getByText('🏷️')).toBeOnTheScreen();
  });
});

describe('ModuleList', () => {
  it('renders nothing when there are no modules', async () => {
    await render(<ModuleList modules={[]} theme={DEFAULT_THEME} price={{ amount: '10.0', currencyCode: 'USD' }} />);
    expect(screen.toJSON()).toBeNull();
  });
});

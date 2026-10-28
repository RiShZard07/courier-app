import { Platform } from 'react-native';

import type { OrderState } from './api/types';

export const colors = {
  background: '#F4F6F8',
  surface: '#FFFFFF',
  border: '#DDE2E8',
  text: '#1B1F24',
  muted: '#5F6B7A',
  primary: '#1F5EFF',
  onPrimary: '#FFFFFF',
  danger: '#B3261E',
  dangerSoft: '#FCEBEA',
  success: '#1B7F3B',
  successSoft: '#E6F4EA',
  warning: '#9A5B00',
  warningSoft: '#FFF3DF',
  info: '#1F5EFF',
  infoSoft: '#E8EEFF',
  neutralSoft: '#ECEFF3',
} as const;

export const stateColors: Record<OrderState, { background: string; foreground: string }> = {
  CREATED: { background: colors.neutralSoft, foreground: colors.muted },
  ACCEPTED: { background: colors.neutralSoft, foreground: colors.muted },
  ASSIGNED: { background: colors.infoSoft, foreground: colors.info },
  PICKED_UP: { background: colors.warningSoft, foreground: colors.warning },
  DELIVERED: { background: colors.successSoft, foreground: colors.success },
  CANCELED: { background: colors.dangerSoft, foreground: colors.danger },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 6, md: 10 } as const;
export const fontSize = { sm: 13, md: 15, lg: 18 } as const;

/** iOS has no font named monospace; Menlo is its stock monospaced face. */
export const monospace = Platform.select({ ios: 'Menlo', default: 'monospace' });

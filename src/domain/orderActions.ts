/**
 * The courier's view of the order state machine. The server (app/state.py) is the source of
 * truth; this module only decides which single button to show, and in which order to list
 * states, so the app never offers a move the server would reject.
 */

import type { Order, OrderState, OrderTransition } from '../api/types';

export interface OrderAction {
  transition: OrderTransition;
  label: string;
  nextState: OrderState;
}

/** The one action a courier may take on an order in this state, or null when there is none. */
export function nextCourierAction(state: OrderState): OrderAction | null {
  switch (state) {
    case 'ASSIGNED':
      return { transition: 'pickup', label: 'Pick up', nextState: 'PICKED_UP' };
    case 'PICKED_UP':
      return { transition: 'deliver', label: 'Deliver', nextState: 'DELIVERED' };
    default:
      return null;
  }
}

export function isTerminalState(state: OrderState): boolean {
  return state === 'DELIVERED' || state === 'CANCELED';
}

const STATE_LABELS: Record<OrderState, string> = {
  CREATED: 'Created',
  ACCEPTED: 'Accepted',
  ASSIGNED: 'Assigned',
  PICKED_UP: 'Picked up',
  DELIVERED: 'Delivered',
  CANCELED: 'Canceled',
};

export function stateLabel(state: OrderState): string {
  return STATE_LABELS[state];
}

/** Active work first, then history, then states a courier should normally never see. */
export const STATE_DISPLAY_ORDER: readonly OrderState[] = [
  'ASSIGNED',
  'PICKED_UP',
  'DELIVERED',
  'CANCELED',
  'ACCEPTED',
  'CREATED',
];

export interface OrderSection {
  state: OrderState;
  title: string;
  data: Order[];
}

/** Group orders into non-empty sections in display order, newest update first within a section. */
export function groupOrdersByState(orders: readonly Order[]): OrderSection[] {
  const sections: OrderSection[] = [];
  for (const state of STATE_DISPLAY_ORDER) {
    const data = orders
      .filter((order) => order.state === state)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    if (data.length > 0) {
      sections.push({ state, title: stateLabel(state), data });
    }
  }
  return sections;
}

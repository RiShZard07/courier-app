import type { OrderState } from '../../api/types';
import { makeOrder } from '../../test/fixtures';
import { groupOrdersByState, isTerminalState, nextCourierAction, stateLabel } from '../orderActions';

describe('nextCourierAction', () => {
  it.each<[OrderState, string | null]>([
    ['CREATED', null],
    ['ACCEPTED', null],
    ['ASSIGNED', 'pickup'],
    ['PICKED_UP', 'deliver'],
    ['DELIVERED', null],
    ['CANCELED', null],
  ])('offers the single legal transition for %s', (state, transition) => {
    expect(nextCourierAction(state)?.transition ?? null).toBe(transition);
  });

  it('labels the button and names the state the move leads to', () => {
    expect(nextCourierAction('ASSIGNED')).toEqual({ transition: 'pickup', label: 'Pick up', nextState: 'PICKED_UP' });
    expect(nextCourierAction('PICKED_UP')).toEqual({ transition: 'deliver', label: 'Deliver', nextState: 'DELIVERED' });
  });
});

describe('isTerminalState', () => {
  it('is true only for DELIVERED and CANCELED', () => {
    expect(isTerminalState('DELIVERED')).toBe(true);
    expect(isTerminalState('CANCELED')).toBe(true);
    expect(isTerminalState('ASSIGNED')).toBe(false);
    expect(isTerminalState('CREATED')).toBe(false);
  });
});

describe('groupOrdersByState', () => {
  it('returns only non-empty sections, active work first, newest update first inside a section', () => {
    const sections = groupOrdersByState([
      makeOrder({ id: 'ord_done', state: 'DELIVERED', updated_at: '2026-10-28T10:00:00.000Z' }),
      makeOrder({ id: 'ord_old', state: 'ASSIGNED', updated_at: '2026-10-28T09:00:00.000Z' }),
      makeOrder({ id: 'ord_carrying', state: 'PICKED_UP', updated_at: '2026-10-28T11:00:00.000Z' }),
      makeOrder({ id: 'ord_new', state: 'ASSIGNED', updated_at: '2026-10-28T12:00:00.000Z' }),
    ]);
    expect(sections.map((section) => section.state)).toEqual(['ASSIGNED', 'PICKED_UP', 'DELIVERED']);
    expect(sections[0]?.title).toBe('Assigned');
    expect(sections[0]?.data.map((order) => order.id)).toEqual(['ord_new', 'ord_old']);
  });

  it('is empty for no orders', () => {
    expect(groupOrdersByState([])).toEqual([]);
  });
});

describe('stateLabel', () => {
  it('renders human labels', () => {
    expect(stateLabel('PICKED_UP')).toBe('Picked up');
    expect(stateLabel('CANCELED')).toBe('Canceled');
  });
});

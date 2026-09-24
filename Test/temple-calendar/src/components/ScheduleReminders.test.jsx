/**
 * ScheduleReminders.test.jsx
 * Covers the "Schedule for later" card extracted out of BroadcastPage.jsx
 * (see that file's git history) — the one-off vs. event-reminders sub-tabs,
 * the reminder-row add/remove controls, and the guard that stops a submit
 * with no channel selected. Had zero direct coverage before this (the old
 * BroadcastPage.test.jsx never exercised this card at all).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScheduleReminders from './ScheduleReminders';

const P = {
  card: '#fff', border: '#e4e4e7', text: '#18181b', muted: '#52525b', faint: '#a1a1aa',
};

function baseProps(overrides = {}) {
  return {
    P,
    selected: { whatsapp: true, facebook: false, instagram: false },
    caption: 'Diwali is coming!',
    autoRSVP: true,
    rsvpUrl: 'https://calendarflyapp.com/calendar?org=test-temple',
    uploadedMedia: null,
    showWATemplate: false,
    selectedWATemplate: { id: 'temple_event_announcement' },
    waVars: ['', '', '', ''],
    ...overrides,
  };
}

describe('ScheduleReminders', () => {
  it('renders collapsed by default', () => {
    render(<ScheduleReminders {...baseProps()} />);
    expect(screen.getByText('Schedule for later')).toBeInTheDocument();
    expect(screen.getByText('▼ Set it up')).toBeInTheDocument();
    expect(screen.queryByText('📌 One-time schedule')).not.toBeInTheDocument();
  });

  it('expands to show both the one-time and event-reminders sub-tabs', async () => {
    const user = userEvent.setup();
    render(<ScheduleReminders {...baseProps()} />);
    await user.click(screen.getByText('Schedule for later'));
    expect(screen.getByText('📌 One-time schedule')).toBeInTheDocument();
    expect(screen.getByText('🔔 Event reminders')).toBeInTheDocument();
    // "once" is the default sub-tab
    expect(screen.getByText('📅 Schedule Broadcast')).toBeInTheDocument();
  });

  it('the Event reminders tab starts with the 7-day/1-day/3-hour defaults and lets you add up to 4', async () => {
    const user = userEvent.setup();
    render(<ScheduleReminders {...baseProps()} />);
    await user.click(screen.getByText('Schedule for later'));
    await user.click(screen.getByText('🔔 Event reminders'));

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.queryByText('#4')).not.toBeInTheDocument();

    await user.click(screen.getByText('+ Add another reminder'));
    expect(screen.getByText('#4')).toBeInTheDocument();
    // Capped at 4 — the "add another" control disappears once the limit is hit.
    expect(screen.queryByText('+ Add another reminder')).not.toBeInTheDocument();
  });

  it('removing a reminder row drops it from the list', async () => {
    const user = userEvent.setup();
    render(<ScheduleReminders {...baseProps()} />);
    await user.click(screen.getByText('Schedule for later'));
    await user.click(screen.getByText('🔔 Event reminders'));

    const removeButtons = screen.getAllByText('✕');
    expect(removeButtons).toHaveLength(3);
    await user.click(removeButtons[0]);
    expect(screen.queryByText('#3')).not.toBeInTheDocument(); // down to 2 rows
    expect(screen.getAllByText('✕')).toHaveLength(2);
  });

  it('disables the one-time Schedule Broadcast button when no channel is selected', async () => {
    // The button is disabled outright (scheduling || !anySelected) rather
    // than clickable-then-erroring — handleSchedule's own "Select at least
    // one channel first" check is a defense-in-depth backstop behind this,
    // not something the UI is meant to expose in this state.
    const user = userEvent.setup();
    render(<ScheduleReminders {...baseProps({ selected: { whatsapp: false, facebook: false, instagram: false } })} />);
    await user.click(screen.getByText('Schedule for later'));
    expect(screen.getByText('📅 Schedule Broadcast').closest('button')).toBeDisabled();
  });

  it('disables the reminders submit button when no channel is selected', async () => {
    const user = userEvent.setup();
    render(<ScheduleReminders {...baseProps({ selected: { whatsapp: false, facebook: false, instagram: false } })} />);
    await user.click(screen.getByText('Schedule for later'));
    await user.click(screen.getByText('🔔 Event reminders'));
    expect(screen.getByText(/🔔 Schedule 3 Reminders/).closest('button')).toBeDisabled();
  });

  it('enables the one-time Schedule Broadcast button once a channel is selected', async () => {
    const user = userEvent.setup();
    render(<ScheduleReminders {...baseProps()} />);
    await user.click(screen.getByText('Schedule for later'));
    expect(screen.getByText('📅 Schedule Broadcast').closest('button')).not.toBeDisabled();
  });
});

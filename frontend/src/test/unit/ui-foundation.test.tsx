import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Button from '../../components/ui/Button';
import Field from '../../components/ui/Field';
import { EmptyState, Notice, Skeleton, StatusBadge } from '../../components/ui/Feedback';
import DesignSystemPage from '../../pages/DesignSystemPage';

describe('shared UI controls', () => {
  it('does not accidentally submit a surrounding form', async () => {
    const submit = vi.fn(event => event.preventDefault());
    const click = vi.fn();
    render(<form onSubmit={submit}><Button onClick={click}>Preview action</Button></form>);
    await userEvent.click(screen.getByRole('button', { name: 'Preview action' }));
    expect(click).toHaveBeenCalledOnce(); expect(submit).not.toHaveBeenCalled();
  });
  it('supports an explicit form submission', async () => {
    const submit = vi.fn(event => event.preventDefault());
    render(<form onSubmit={submit}><Button type="submit">Submit choices</Button></form>);
    await userEvent.click(screen.getByRole('button', { name: 'Submit choices' }));
    expect(submit).toHaveBeenCalledOnce();
  });
  it('blocks repeat actions while retaining the loading label', async () => {
    const click = vi.fn();
    render(<Button loading onClick={click}>Save profile</Button>);
    const button = screen.getByRole('button', { name: 'Save profile' });
    expect(button).toBeDisabled(); expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button); expect(click).not.toHaveBeenCalled();
  });
  it('associates labels, help and errors without dropping existing descriptions', () => {
    render(<><span id="existing-help">Existing description.</span><Field id="name" label="Display name" hint="Public display name." error="Enter a name."><input aria-describedby="existing-help" /></Field></>);
    const input = screen.getByLabelText('Display name');
    expect(input).toHaveAccessibleDescription('Existing description. Public display name. Enter a name.');
    expect(input).toHaveAttribute('aria-invalid', 'true'); expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.');
  });
  it('keeps native select and checkbox keyboard interactions', async () => {
    render(<><Field id="department" label="Department"><select defaultValue="ICT"><option>ICT</option><option>ET</option></select></Field><label><input type="checkbox" />Photography</label></>);
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'ET');
    expect(screen.getByLabelText('Department')).toHaveValue('ET');
    const choice = screen.getByRole('checkbox', { name: 'Photography' }); choice.focus();
    await userEvent.keyboard(' '); expect(choice).toBeChecked();
  });
  it('describes errors and loading without relying on color or fake counts', () => {
    render(<><Notice tone="error">Unable to load. Try again.</Notice><Skeleton label="Loading opportunities" /><StatusBadge tone="warning">Pending verification</StatusBadge><EmptyState title="No saved opportunities">Save an opportunity to return later.</EmptyState></>);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load. Try again.');
    expect(screen.getByRole('status')).toHaveTextContent('Loading opportunities');
    expect(screen.getByText('Pending verification')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No saved opportunities' })).toBeInTheDocument();
  });
  it('validates the gallery form and keeps its choices local', async () => {
    render(<DesignSystemPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Preview preferences' }));
    expect(screen.getByLabelText('Profile display name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Add a display name before continuing.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Profile display name'), 'Synthetic Student');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Video editing' }));
    await userEvent.click(screen.getByRole('button', { name: 'Preview preferences' }));
    expect(screen.getByText('Preview updated. No account data was saved.')).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Save sample opportunity' }));
    expect(screen.getByRole('button', { name: 'Unsave sample opportunity' })).toHaveAttribute('aria-pressed', 'true');
  });
});

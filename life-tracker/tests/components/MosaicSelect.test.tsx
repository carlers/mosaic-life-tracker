import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MosaicSelect } from '../../src/components/ui/MosaicSelect';

const choices = [
  { value: 'a', label: 'Alpha', color: '#10B981' },
  { value: 'b', label: 'Beta', description: 'Second option' },
  { value: 'c', label: 'Charlie', disabled: true },
];

describe('MosaicSelect', () => {
  it('renders a controlled value and selects via the portaled listbox', () => {
    function Example() {
      const [value, setValue] = useState('a');
      return <MosaicSelect label="Favorite" value={value} onChange={setValue} options={choices} />;
    }
    render(<Example />);
    const trigger = screen.getByRole('combobox', { name: 'Favorite: Alpha' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox', { name: 'Favorite' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('option', { name: /Beta/ }));
    expect(screen.getByRole('combobox', { name: 'Favorite: Beta' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox', { name: 'Favorite' })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('navigates by arrow and Home/End; Escape returns focus without changing value', () => {
    const onChange = vi.fn();
    render(<MosaicSelect label="Favorite" value="a" onChange={onChange} options={choices} />);
    const trigger = screen.getByRole('combobox', { name: 'Favorite: Alpha' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const menu = screen.getByRole('listbox', { name: 'Favorite' });
    fireEvent.keyDown(menu, { key: 'End' });
    expect(screen.getByRole('option', { name: /Beta/ })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('does not allow disabled choices, and ignores selecting an unchanged value', () => {
    const onChange = vi.fn();
    render(<MosaicSelect label="Favorite" value="a" onChange={onChange} options={choices} />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'Charlie' })).toBeDisabled();
    fireEvent.click(screen.getByRole('option', { name: 'Charlie' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('option', { name: 'Alpha' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('reflects external changes without persisting or remapping a value', () => {
    const onChange = vi.fn();
    const { rerender } = render(<MosaicSelect label="Setting" value="a" options={choices} onChange={onChange} />);
    rerender(<MosaicSelect label="Setting" value="b" options={choices} onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Setting: Beta' })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    rerender(<MosaicSelect label="Setting" value="" options={choices} placeholder="Choose" onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Setting: Choose' })).toBeInTheDocument();
  });


  it('returns Tab focus to the next field rather than the body portal', () => {
    const onChange = vi.fn();
    render(<div>
      <MosaicSelect label="Setting" value="a" options={choices} onChange={onChange} />
      <input aria-label="Next field" />
    </div>);
    fireEvent.click(screen.getByRole('combobox'));
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'Tab' });
    expect(screen.getByRole('textbox', { name: 'Next field' })).toHaveFocus();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('consumes typeahead keys before they can trigger parent navigation shortcuts', () => {
    const onKeyDown = vi.fn();
    render(<div onKeyDown={onKeyDown}>
      <MosaicSelect label="Setting" value="a" options={choices} onChange={vi.fn()} />
    </div>);
    fireEvent.click(screen.getByRole('combobox'));
    onKeyDown.mockClear();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'b' });
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: /Beta/ })).toHaveFocus();
  });

  it('closes on outside pointer press and prevents a disabled control from opening', () => {
    const onChange = vi.fn();
    const view = render(<MosaicSelect label="Setting" value="a" options={choices} onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    view.rerender(<MosaicSelect label="Setting" value="a" options={choices} disabled onChange={onChange} />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});

import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MosaicCategorySelect } from '../../src/components/ui/MosaicCategorySelect';

const categories = [
  { id:'cat_run', name:'Running', color:'#3B82F6', isDeleted:false },
  { id:'cat_gym', name:'Gym', color:'#10B981', isDeleted:false },
  { id:'cat_deleted', name:'Retired', color:'#A855F7', isDeleted:true },
];

describe('MosaicCategorySelect', () => {
  it('always shows the selected category color without changing the standard trigger style', () => {
    function Example() {
      const [value,setValue] = useState('cat_run');
      return <MosaicCategorySelect label="Workout category" value={value}
        onChange={setValue} categories={categories} variant="compact" />;
    }
    render(<Example/>);
    let trigger=screen.getByRole('combobox',{name:'Workout category: Running'});
    expect(trigger.querySelector('[style*="background-color"]')).toHaveStyle('background-color: #3B82F6');
    fireEvent.click(trigger);
    const list=screen.getByRole('listbox',{name:'Workout category'});
    expect(list.querySelectorAll('[style*="background-color"]')).toHaveLength(2);
    expect(screen.queryByRole('option',{name:'Retired'})).toBeNull();
    fireEvent.click(screen.getByRole('option',{name:'Gym'}));
    trigger=screen.getByRole('combobox',{name:'Workout category: Gym'});
    expect(trigger.querySelector('[style*="background-color"]')).toHaveStyle('background-color: #10B981');
  });
  it('retains special options without inventing category colors', () => {
    render(<MosaicCategorySelect label="Timeline category" value=""
      onChange={()=>undefined} options={[
        {value:'',label:'All categories'},
        {value:'cat_run',label:'Running',color:'#3B82F6'},
      ]}/>);
    expect(screen.getByRole('combobox',{name:'Timeline category: All categories'})
      .querySelector('[style*="background-color"]')).toBeNull();
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option',{name:'Running'}).querySelector('[style*="background-color"]'))
      .toHaveStyle('background-color: #3B82F6');
  });
});

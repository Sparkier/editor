import * as React from 'react';
import {useDispatch} from 'react-redux';
import {useAppSelector} from '../../hooks';
import {setDataflowColoring, selectedColoringSelector} from '../dataflow/colorSlice';

export function Controls() {
  const dispatch = useDispatch();
  const coloring: string = useAppSelector(selectedColoringSelector);

  return (
    <div>
      <form onChange={(e) => dispatch(setDataflowColoring((e.target as HTMLInputElement).value))}>
        <p>Color dataflow graph by:</p>
        <input type="radio" value="type" name="dataflow_color" checked={coloring === 'type'} />
        Node Type
        <input type="radio" value="time" name="dataflow_color" checked={coloring === 'time'} />
        Time
      </form>
    </div>
  );
}

import * as React from 'react';
import {useDispatch} from 'react-redux';
import {useAppSelector} from '../../hooks';
import {setDataflowColoring, selectedColoringSelector} from '../dataflow/colorSlice';
import {Values} from '../dataflow/pulsesSlice';
import {setTimingRange} from '../dataflow/rangeSlice';
import {selectedValuesSelector} from '../dataflow/selectionSlice';
import './Controls.css';

export function Controls() {
  const dispatch = useDispatch();
  const coloring: string = useAppSelector(selectedColoringSelector);
  const values = useAppSelector(selectedValuesSelector);

  const toggle = (e) => dispatch(setDataflowColoring((e.target as HTMLInputElement).value));

  return (
    <div>
      <form>
        <p>Color dataflow graph by:</p>
        <input type="radio" value="type" name="dataflow_color" onChange={toggle} checked={coloring === 'type'} />
        Node Type
        <input type="radio" value="time" name="dataflow_color" onChange={toggle} defaultChecked={coloring === 'time'} />
        Time
      </form>
      {values !== null && (
        <Slider
          values={values}
          onChange={({min, max}: {min: number; max: number}) => dispatch(setTimingRange({min, max}))}
        />
      )}
    </div>
  );
}

interface SliderProps {
  values: Values;
  onChange: ({min, max}: {min: number; max: number}) => void;
}

const Slider: React.FC<SliderProps> = ({values, onChange}) => {
  const time = Object.entries(values).map((v) => {
    return v[1]['value'].time as number;
  });
  let max = Math.ceil(Math.max(...time) * 100) / 100;
  let min = Math.floor(Math.min(...time) * 100) / 100;
  const [minVal, setMinVal] = React.useState(min);
  const [maxVal, setMaxVal] = React.useState(max);
  const minValRef = React.useRef<HTMLInputElement>(null);
  const maxValRef = React.useRef<HTMLInputElement>(null);
  const range = React.useRef<HTMLDivElement>(null);
  const getPercent = React.useCallback((value: number) => Math.round(((value - min) / (max - min)) * 100), [min, max]);

  React.useEffect(() => {
    max = Math.ceil(Math.max(...time) * 100) / 100;
    min = Math.floor(Math.min(...time) * 100) / 100;
    setMinVal(min);
    setMaxVal(max);
  }, [values]);

  React.useEffect(() => {
    if (maxValRef.current) {
      const minPercent = getPercent(minVal);
      const maxPercent = getPercent(+maxValRef.current.value);

      if (range.current) {
        range.current.style.left = `${minPercent}%`;
        range.current.style.width = `${maxPercent - minPercent}%`;
      }
    }
  }, [minVal, getPercent]);

  React.useEffect(() => {
    if (minValRef.current) {
      const minPercent = getPercent(+minValRef.current.value);
      const maxPercent = getPercent(maxVal);

      if (range.current) {
        range.current.style.width = `${maxPercent - minPercent}%`;
      }
    }
  }, [maxVal, getPercent]);

  React.useEffect(() => {
    onChange({min: minVal, max: maxVal});
  }, [minVal, maxVal, onChange]);

  return (
    <>
      {min !== max && (
        <div className="container">
          <input
            type="range"
            min={min}
            max={max}
            step={0.01}
            value={minVal}
            ref={minValRef}
            onChange={(event) => {
              const value = Math.min(+event.target.value, maxVal);
              setMinVal(value);
              event.target.value = value.toString();
            }}
            className="thumb thumb--zindex-3"
          />
          <input
            type="range"
            min={min}
            max={max}
            step={0.01}
            value={maxVal}
            ref={maxValRef}
            onChange={(event) => {
              const value = Math.max(+event.target.value, minVal);
              setMaxVal(value);
              event.target.value = value.toString();
            }}
            className="thumb thumb--zindex-4"
          />
          <div className="slider">
            <div className="slider__track" />
            <div ref={range} className="slider__range"></div>
            <div className="slider__left-value">{minVal}</div>
            <div className="slider__right-value">{maxVal}</div>
          </div>
        </div>
      )}
    </>
  );
};

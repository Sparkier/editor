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
  const values: Values = useAppSelector(selectedValuesSelector);

  const toggle = (e) => dispatch(setDataflowColoring((e.target as HTMLInputElement).value));

  if (values) {
    const time = Object.entries(values).map((v) => {
      return v[1]['value'].time as number;
    });
    const max_value = Math.ceil(Math.max(...time) * 100) / 100;
    const min_value = Math.floor(Math.min(...time) * 100) / 100;

    return (
      <div className="controls-container">
        <form className="control-container">
          <p>Color graph by:</p>
          <input type="radio" value="type" name="dataflow_color" onChange={toggle} checked={coloring === 'type'} />
          Node Type
          <input type="radio" value="time" name="dataflow_color" onChange={toggle} checked={coloring === 'time'} />
          Time
        </form>
        {values !== null && (
          <div className="control-container">
            <p>Filter graph timings:</p>
            <Slider
              values={{min: min_value, max: max_value}}
              onChange={({min, max}) => dispatch(setTimingRange({min, max}))}
            />
          </div>
        )}
      </div>
    );
  }
  return null;
}

interface SliderProps {
  values: {min: number; max: number};
  onChange: ({min, max}: {min: number; max: number}) => void;
}

const Slider: React.FC<SliderProps> = ({values, onChange}) => {
  const {min, max} = values;

  const [minVal, setMinVal] = React.useState(min);
  const [maxVal, setMaxVal] = React.useState(max);

  React.useEffect(() => {
    setMinVal(min);
    setMaxVal(max);
  }, [values.min, values.max]);

  const minValRef = React.useRef<HTMLInputElement>(null);
  const maxValRef = React.useRef<HTMLInputElement>(null);
  const range = React.useRef<HTMLDivElement>(null);
  const getPercent = React.useCallback((value: number) => Math.round(((value - min) / (max - min)) * 100), [min, max]);

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
        <div className="slider__min-value">{min}</div>
        <div className="slider__max-value">{max}</div>

        <div className="slider__track" />
        <div ref={range} className="slider__range"></div>
        <div className="slider__left-value">{minVal}</div>
        <div className="slider__right-value">{maxVal}</div>
      </div>
    </div>
  );
};

import * as React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useAppSelector} from '../../hooks';
import {selectionSelector, selectedHighlightSelector, Highlight, setHighlight} from '../dataflow/highlightSlice';
import {State} from '../../constants/default-state';
import {selectedPulseSelector} from '../dataflow/selectionSlice';
import {Pulse, pulsesSelector, PulsesState, Values} from '../dataflow/pulsesSlice';
import {createSelector} from '@reduxjs/toolkit';
import vegaTooltip from 'vega-tooltip';
import * as vega from 'vega';
import {Popup} from '../../components/popup';
import {Spec} from 'vega';
import ErrorBoundary from '../../components/error-boundary/renderer';
import {InsertTextFormat} from 'vscode-languageserver-types';
import {Hover, hoverSelector, setHover} from '../dataflow/hoverSlice';
export function PerfChart() {
  const flame_chart = React.useMemo(() => <Flame />, []);

  return flame_chart;
}
export function Flame() {
  const pulse = useSelector<State>(selectedPulseSelector); // pulse selected by the sidebar

  const selectedValuesSelector = createSelector(pulsesSelector, selectedPulseSelector, (pulses, selected) =>
    selected === null ? null : pulses.find((p) => p.clock === selected).values
  );
  const selectedValues = useAppSelector(selectedValuesSelector);
  const all_pulses = useAppSelector((state) => state.pulses);
  console.log(all_pulses, 'defalutdpulse??');
  console.log(pulse, 'pulse??');
  const highlight: Highlight = useAppSelector(selectedHighlightSelector);
  const hover: Hover = useAppSelector(hoverSelector);

  const view = useSelector<State>((state) => state.view);
  const mapping = view['mapping'];

  return (
    <CreateFlameChart
      pulses={all_pulses}
      selected={selectedValues}
      mapping={mapping}
      highlight={highlight}
      hover={hover}
    />
  );
}
export function CreateFlameChart({
  pulses,
  selected,
  mapping,
  highlight,
  hover,
}: {
  pulses: PulsesState;
  selected: Values | null;
  mapping: any;
  highlight: Highlight | null;
  hover: Hover | null;
}) {
  const pulse_1 = pulses.length ? pulses[0] : null;

  const flame_template: Spec = {
    $schema: 'https://vega.github.io/schema/vega/v5.json',
    description: 'An example of a space-fulling radial layout for hierarchical data.',
    width: 800,
    height: 100,
    padding: 5,
    autosize: 'none',
    signals: [
      {
        name: 'hover',
        value: null,
        on: [
          {
            events: 'rect:mouseover',
            update: ' datum.id',
            force: true,
          },
        ],
      },
      {
        name: 'clear',
        value: true,
        on: [
          {
            events: 'dblclick, mouseup[!event.item]',
            update: 'true',
            force: true,
          },
        ],
      },
      {
        name: 'clicked',
        value: null,
        on: [
          {
            events: 'rect:click, @legendLabel:click',
            update: '{value: datum.id}',
            force: true,
          },
        ],
      },
    ],
    data: [
      {
        name: 'tree',
        values: [],
        transform: [
          {type: 'stratify', key: 'id', parentKey: 'parent'},
          {
            type: 'partition',
            field: 'time',
            sort: {field: 'id'},
            size: [{signal: 'width'}, {signal: 'height'}],
          },
        ],
      },
      {
        name: 'selected',
        on: [
          {trigger: 'clear', remove: true},
          {trigger: 'clicked', insert: 'clicked'},
        ],
      },
      {
        name: 'hover',
        on: [{trigger: 'hover', remove: true, insert: 'hover'}],
      },
    ],
    scales: [
      {
        name: 'color',
        type: 'ordinal',
        domain: {data: 'tree', field: 'parent'},
        range: {scheme: 'tableau20'},
      },
      // {
      //   "name": "size",
      //   "type": "ordinal",
      //   "domain": {data: 'tree', field: 'depth'},
      //   "range": [ 28, 20, 14]
      // },
    ],
    marks: [
      {
        type: 'rect',
        from: {data: 'tree'},
        encode: {
          enter: {
            x: {field: 'x0'},
            y: {field: 'y0'},
            x2: {field: 'x1'},
            y2: {field: 'y1'},
            fill: {scale: 'color', field: 'parent'},
            stroke: {value: '#fff'},
            tooltip: {
              signal: "'op: ' + datum.id + (datum.time ? ', time: ' + datum.time + ' ms' : '')",
            },
          },
          update: {
            fill: [
              {
                test: " (!length(data('selected')) || indata('selected', 'value', datum.id))",
                scale: 'color',
                field: 'parent',
              },
              // {scale: 'color', field: 'parent'}]
              {value: '#ccc'},
            ],
          },
          hover: {
            fill: {value: 'red'},
            strokeWidth: {value: 2},
            zindex: {value: 1},
          },
        },
      },
    ],
  };

  const divRef = React.useRef(null) as any;
  const chartRef = React.useRef(null);
  const dispatch = useDispatch();
  const handler = React.useCallback(
    (name, value) => {
      if (value) {
        console.log(value, 'hover value');
        chartRef.current.signal('clicked', {value: value.datum.id}).run();
        if (value.datum.children === 0) {
          dispatch(setHover({paths: [], ids: [value.datum.id]}));
        } else {
          const to_highlight = [];
          const paths = [value.datum.id];

          for (const key in mapping) {
            if (key.includes(value.datum.id)) {
              to_highlight.push(...mapping[key]);
              const key_substrs = key.match(/\[([^[]*)\]/g);
              console.log(key_substrs);
              let prefix = '';
              for (const substr of key_substrs) {
                prefix += substr;
                if (prefix.includes(value.datum.id)) {
                  paths.push(prefix);
                }
              }
              paths.push(key);
            }
          }
          dispatch(setHover({paths: paths, ids: to_highlight}));
        }
      }
    },
    [dispatch]
  );

  const cancel_hover = React.useCallback(
    (name, value) => {
      if (value) {
        dispatch(setHover({paths: [], ids: []}));
      }
    },
    [dispatch]
  );

  React.useEffect(() => {
    async function renderChart() {
      if (chartRef.current) {
        chartRef.current._postrun = [];
        chartRef.current.finalize();
      }

      const runtime = vega.parse(flame_template);
      const view = new vega.View(runtime, {hover: true});
      const divElement = divRef.current;
      view.removeEventListener('mouseover', handler);
      view.removeEventListener('mouseout', cancel_hover);

      chartRef.current = view;
      view.renderer('svg').initialize(divElement);

      await view.runAsync();

      // Tooltip needs to be added after initializing the view with `chart`
      vegaTooltip(view);

      // view.addSignalListener('hover', handler)
      view.addEventListener('mouseover', handler);
      view.addEventListener('mouseout', cancel_hover);
    }
    renderChart().catch(console.error);
  }, [divRef.current]);

  React.useEffect(() => {
    async function renderChart() {
      const flameInput = [];
      const inputKeys = new Set<string>();

      if (pulse_1) {
        flameInput.push({id: 'root'});
        for (const path_str in mapping) {
          const path = path_str.match(/\[([^[]*)\]/g);
          let prefix = '';
          let prev_prefix = null;

          for (const p of path) {
            prefix += `${p}`;
            if (!inputKeys.has(prefix)) {
              if (!prev_prefix) {
                flameInput.push({id: prefix, parent: 'root'});
              } else {
                flameInput.push({id: prefix, parent: prev_prefix});
              }
            }
            prev_prefix = prefix;
            inputKeys.add(prefix);
          }

          for (const op of mapping[path_str]) {
            if (selected) {
              if (selected[op]) flameInput.push({id: op, parent: path_str, time: selected[op]['value'].time});
            } else {
              if (pulse_1.values[op])
                flameInput.push({id: op, parent: path_str, time: pulse_1.values[op]['value'].time});
            }
          }
        }
      }

      chartRef.current.data('tree', flameInput);

      await chartRef.current.runAsync();
    }
    renderChart().catch(console.error);
  }, [mapping, selected, pulse_1]);

  React.useEffect(() => {
    async function renderChart() {
      const values = [];
      chartRef.current.signal('clear', {value: true});
      await chartRef.current.runAsync();

      if (highlight) {
        for (const id of highlight.ids) {
          values.push({value: id});
        }

        chartRef.current.data('selected', values);
        await chartRef.current.runAsync();
      }
    }
    renderChart().catch(console.error);
  }, [highlight]);

  React.useEffect(() => {
    async function renderChart() {
      // let values = chartRef.current.data('selected')
      const values = [];
      chartRef.current.signal('clear', {value: true});
      await chartRef.current.runAsync();
      // let toRemove = chartRef.current.data('hover')

      if (hover) {
        for (const id of hover.ids) {
          values.push({value: id});
        }
        for (const path of hover.paths) {
          values.push({value: path});
        }

        chartRef.current.data('selected', values);
        // chartRef.current.data('selected',vega.changeset().insert(values).remove([toRemove]))
        await chartRef.current.runAsync();
      }
    }
    renderChart().catch(console.error);
  }, [hover]);

  const renderer = (
    <div className="chart" style={{backgroundColor: 'white'}}>
      <Popup
        content={`Click on "Continue Recording" to make the chart interactive`}
        placement="right"
        // Make skinnier so it fits on the right side of the chart
        maxWidth={200}
      >
        <div className="chart-overlay"></div>
      </Popup>
      <div aria-label="visualization" ref={divRef} style={{}} />
      {/* <div className="chart-resize-handle">
        <svg width="10" height="10">
          <path d="M-2,13L13,-2 M-2,16L16,-2 M-2,19L19,-2" />
        </svg>
      </div> */}
    </div>
  );
  return (
    <div>
      {/* <div className="chartcontainer"> */}
      <ErrorBoundary>{renderer}</ErrorBoundary>
      {/* </div> */}
    </div>
  );
}

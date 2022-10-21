import * as d3 from 'd3';
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

export function FlameChart() {
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

  const pulse_1 = all_pulses.length ? all_pulses[0] : null;

  // generate the data input for performance chart
  const dataInput = React.useMemo(() => {
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
          if (selectedValues) {
            if (selectedValues[op]) {
              flameInput.push({
                id: op,
                parent: path_str,
                time: selectedValues[op]['value'].time,
                value: selectedValues[op]['value'].time + 0.01,
              });
            }
          } else {
            if (pulse_1.values[op]) {
              flameInput.push({
                id: op,
                parent: path_str,
                time: pulse_1.values[op]['value'].time,
                value: pulse_1.values[op]['value'].time + 0.01,
              });
            }
          }
        }
      }

      return flameInput;
    }
    return null;
  }, [mapping, selectedValues, pulse_1]);

  return <CreateFlameChart flameInput={dataInput} highlight={highlight} hover={hover} />;
}

export function CreateFlameChart({
  flameInput,
  highlight,
  hover,
}: {
  // pulses: PulsesState;
  // selected: Values | null;
  // mapping: any;
  flameInput: any;
  highlight: Highlight | null;
  hover: Hover | null;
}) {
  const chartRef = React.useRef(null);
  const dispatch = useDispatch();

  const svg = d3.select(chartRef.current);

  const dataSet = React.useMemo(() => {
    const parents = new Set<string>();

    if (flameInput) {
      for (const item of flameInput) {
        if (item.parent) parents.add(item.parent);
      }
    }
    return [...parents];
  }, [flameInput]);

  const tree_data = React.useMemo(() => {
    if (flameInput) return tree(flameInput)[0];
    return null;
  }, [flameInput]);

  React.useEffect(() => {
    if (tree_data && dataSet.length != 0) {
      console.log(tree_data);
      const data = partition(tree_data);
      let focus = data;
      console.log(data, 'datainput');
      // const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));
      const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, dataSet.length + 1));
      // // const color = d3.scaleOrdinal(data.parent, d3.schemeCategory10);

      // var hue = d3.scaleOrdinal()
      // .domain([...dataSet])
      // .range(d3.schemeTableau10);
      // console.log((dataSet),"datamap")

      // var luminance = d3.scaleSqrt()
      //     .domain([0, 1e6])
      //     .clamp(true)
      //     .range([90, 20]);

      // const color = (d) => {
      //     // var p = d;
      //     // while (p.depth > 1) p = p.parent;
      //     // var c = d3.lab(hue(p.id));
      //     // c.l = luminance(d.sum);
      //     // return c;
      //     return hue(d.parent)
      // }

      const clicked = (event, p) => {
        if (p.depth != 0) {
          focus = focus === p ? (p = p.parent) : p;

          data.each(
            (d: any) =>
              (d.target = {
                x0: ((d.x0 - p.x0) / (p.x1 - p.x0)) * width,
                x1: ((d.x1 - p.x0) / (p.x1 - p.x0)) * width,
                y0: d.y0 - p.y0,
                y1: d.y1 - p.y0,
              })
          );

          const t = cell
            .transition()
            .duration(750)
            .attr('transform', (d: any) => `translate(${d.target.x0},${d.target.y0})`);

          rect.transition(t).attr('width', (d: any) => rectWidth(d.target));
          text.transition(t).attr('fill-opacity', (d: any) => +labelVisible(d.target));
          tspan.transition(t).attr('fill-opacity', (d: any) => (labelVisible(d.target) as any) * 0.7);
        }
      };

      const dblclick = () => {
        focus = data;

        const t = cell
          .transition()
          .duration(750)
          .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

        rect.transition(t).attr('width', (d: any) => rectWidth(d));
        text.transition(t).attr('fill-opacity', (d: any) => +labelVisible(d));
        tspan.transition(t).attr('fill-opacity', (d: any) => (labelVisible(d) as any) * 0.7);
      };

      const rectWidth = (d) => {
        return d.x1 - d.x0 - Math.min(1, (d.x1 - d.x0) / 2);
      };

      const labelVisible = (d) => {
        return (
          d.y1 <= height &&
          d.x0 >= 0 &&
          (d.x1 - d.x0 > 50 || (d.x1 - d.x0 > 20 && (d.data ? `${d.data.id}` : `${d.id}`).length < 10))
        );
      };

      const onHover = (d, i) => {
        console.log(i);
        rect.attr('fill-opacity', (x) => {
          return x == i ? 0.6 : 0.1;
        });
      };

      const cell = svg
        .selectAll('g')
        .data(data.descendants())
        .join('g')
        .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

      const rect = cell
        .append('rect')
        .attr('width', (d: any) => rectWidth(d))
        .attr('height', (d: any) => d.y1 - d.y0 - 1)
        .attr('fill-opacity', 0.6)
        .attr('fill', (d: any) => {
          if (!d.depth) return '#ccc';
          // while (d.depth > 1) d = d.parent;
          // return color(d.data.id);
          return color(d.parent.data.id);
        })
        .style('cursor', 'pointer')
        .on('click', clicked);
      rect.on('mouseover', onHover).on('mouseout', () => {
        rect.attr('fill-opacity', 0.6);
      });
      svg.on('dblclick', dblclick);

      const text = cell
        .append('text')
        .style('user-select', 'none')
        .attr('pointer-events', 'none')
        .attr('x', 4)
        .attr('y', 13)
        .attr('fill-opacity', (d) => +labelVisible(d));

      text
        .append('tspan')
        .attr('x', 0)
        .attr('dy', '0em')
        .text((d: any) => d.data.id);
      text
        .append('tspan')
        .attr('x', 0)
        .attr('dy', '1em')
        .text((d: any) => `${format(d.value)}`);

      const tspan = text.append('tspan').attr('fill-opacity', (d: any) => (labelVisible(d) as any) * 0.7);
      // .attr("dy", "1.2em")
      // .text(d => ` ${format(d.value)}`);

      cell.append('title').text(
        (d: any) =>
          `${d
            .ancestors()
            .map((i) => i.data.id)
            .reverse()
            .join('/')}\n${format(d.value)}`
      );
    }
  }, [tree_data]);

  const renderer = (
    <div style={{backgroundColor: 'white'}}>
      <Popup
        content={`Click on "Continue Recording" to make the chart interactive`}
        placement="right"
        // Make skinnier so it fits on the right side of the chart
        maxWidth={200}
      >
        <div className="chart-overlay"></div>
      </Popup>
      <div className="chart" aria-label="performance flame chart" style={{}}>
        <svg height={height} width={width} ref={chartRef} fontSize="10" />
        {/* <div className="chart-resize-handle">
            <svg width="10" height="10">
            <path d="M-2,13L13,-2 M-2,16L16,-2 M-2,19L19,-2" />
            </svg>
            </div> */}
      </div>
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

const width = 975;
const height = 200;

const partition = (data) => {
  // console.log(tree(data))
  // const stratify_data = tree(data)
  // console.log(stratify_data)
  const root = d3.hierarchy(data).sum((d: any) => d.value);
  // .sort((a, b) =>  b.data.name - a.data.name);
  return d3.partition().size([width, ((root.height + 1) * height) / (root.height + 1)])(root);
};

const format = d3.format(',d');

const tree = (data) => {
  // Map element name to arr index
  const dataMap = data.reduce((acc, el, i) => {
    acc[el.id] = i;
    return acc;
  }, {});

  // construct a nested tree from the data array
  const nestData = [];

  data.forEach((el) => {
    if ('parent' in el) {
      if (!data[dataMap[el.parent]].children) {
        data[dataMap[el.parent]].children = [];
      }
      data[dataMap[el.parent]].children.push(el);
    } else {
      nestData.push(el);
    }
  });
  return nestData;
};

import * as d3 from 'd3';
import * as React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useAppSelector} from '../../hooks';
import {selectedHighlightSelector, Highlight, setHighlight} from '../dataflow/highlightSlice';
import {State} from '../../constants/default-state';
import {selectedPulseSelector} from '../dataflow/selectionSlice';
import {pulsesSelector} from '../dataflow/pulsesSlice';
import {createSelector} from '@reduxjs/toolkit';
import {Popup} from '../../components/popup';
import {None} from 'vega';
import ErrorBoundary from '../../components/error-boundary';
import {Hover, hoverSelector, setHover} from '../dataflow/hoverSlice';

export function Flame() {
  const selectedValuesSelector = createSelector(pulsesSelector, selectedPulseSelector, (pulses, selected) =>
    selected === null ? null : pulses.find((p) => p.clock === selected).values
  );
  const selectedValues = useAppSelector(selectedValuesSelector);
  const all_pulses = useAppSelector((state) => state.pulses);
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
  flameInput: any;
  highlight: Highlight | null;
  hover: Hover | null;
}) {
  const chartRef = React.useRef(null);
  const dispatch = useDispatch();
  const hoverRef = React.useRef(null);

  const svg = d3.select(chartRef.current);
  const width = 975;
  const height = 200;

  const partition = (data) => {
    const root = d3.hierarchy(data).sum((d: any) => d.value);
    return d3.partition().size([width, ((root.height + 1) * height) / (root.height + 1)])(root);
  };

  const parents = React.useMemo(() => {
    const results = new Set<string>();

    if (flameInput) {
      for (const item of flameInput) {
        if (item.parent) results.add(item.parent);
      }
    }
    return [...results];
  }, [chartRef.current, flameInput]);

  const tree_data = React.useMemo(() => {
    if (flameInput) return tree(JSON.parse(JSON.stringify(flameInput)))[0];
    return null;
  }, [flameInput]);

  React.useEffect(() => {
    if (tree_data && parents.length != 0) {
      const data = partition(tree_data);
      let focus = data;
      const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, parents.length + 1));

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

        dispatch(setHighlight(hoverRef.current));
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

        dispatch(setHighlight(null));
      };

      const rectWidth = (d) => {
        return d.x1 - d.x0 - Math.min(1, (d.x1 - d.x0) / 2);
      };

      const stripId = (id: string) => {
        // strip the id so that we don't have awkward-looking strings here
        const result = `${id}`.replace(/^(.*[[])/, ''); // remove all up to last [
        return result.replace(/"|\]/g, ''); // replace all " and ] characters
      };

      const deriveId = (d: any) => {
        // derive an id if it is multi-leveled (e.g. "[foo][bar]" => "foo -> bar")
        let id = `${d.id}`;
        if (!isNaN(+id) && d.parent) {
          // if it is a number, add the parent for more information
          id = `${d.parent}[${id}`;
        }
        const result = `${id}`.replace(/\]\[/g, ' -> ');
        return result.replace(/]|\[|"/g, '');
      };

      const labelVisible = (d) => {
        return (
          d.y1 <= height &&
          d.x0 >= 0 &&
          (d.x1 - d.x0 > 50 || (d.x1 - d.x0 > 20 && (d.data ? `${d.data.id}` : stripId(d.id)).length < 10))
        );
      };

      const onHover = (d, i) => {
        rect.attr('stroke', (x) => {
          return x == i ? 'red' : None;
        });

        const target: Highlight = {paths: [i.data.id], ids: []};
        const queue = [i];
        target.target = i.children ? i.data.id : i.data.parent;

        while (queue.length) {
          const curr = queue.shift();
          if (!curr.children) {
            target.ids.push(curr.data.id);
          } else {
            for (const child of curr.children) {
              queue.push(child);
              target.paths.push(child.data.id);
            }
          }
        }

        dispatch(setHover(target));
        hoverRef.current = target;
      };

      d3.select(chartRef.current).selectAll('g').remove();

      const cell = d3
        .select(chartRef.current)
        .selectAll('g')
        .data(data.descendants())
        .join(function (enter) {
          return enter.append('g');
        })
        .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

      const rect = cell
        .append('rect')
        .attr('width', (d: any) => rectWidth(d))
        .attr('height', (d: any) => d.y1 - d.y0 - 1)
        .attr('fill-opacity', 0.6)
        .attr('fill', (d: any) => {
          if (!d.depth) return '#ccc';
          return color(d.parent.data.id);
        })
        .style('cursor', 'pointer')
        .style('stroke-width', 2)
        .on('click', clicked);
      rect.on('mouseover', onHover).on('mouseout', () => {
        rect.attr('stroke', None);
        dispatch(setHover(null));
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
        .text((d: any) => stripId(d.data.id));
      text
        .append('tspan')
        .attr('x', 0)
        .attr('dy', '1em')
        .text((d: any) => `${format(d.data.time !== undefined ? d.data.time : d.value)}`);

      const tspan = text.append('tspan').attr('fill-opacity', (d: any) => (labelVisible(d) as any) * 0.7);

      cell
        .append('title')
        .text((d: any) => `${deriveId(d.data)}\ntime: ${format(d.data.time !== undefined ? d.data.time : d.value)} ms`);
    }
  }, [chartRef.current, tree_data]);

  React.useEffect(() => {
    const values = [];
    if (hover) {
      for (const id of hover.ids) {
        values.push(id);
        if (typeof id === 'string' && !id.includes(':')) values.push(parseInt(id));
      }
      for (const path of hover.paths) {
        values.push(path);
      }
    }

    d3.select(chartRef.current)
      .selectAll('rect')
      .attr('stroke', (x: any) => {
        if (!x.depth) return None;
        return values.includes(x.data.id) || values.includes(x.data.parent) ? '#0066cc' : None;
      });
  }, [hover]);

  React.useEffect(() => {
    const values = [];

    if (highlight) {
      for (const id of highlight.ids) {
        values.push(id);
      }
      for (const path of highlight.paths) {
        values.push(path);
      }

      d3.select(chartRef.current)
        .selectAll('rect')
        .attr('fill-opacity', (d: any) => {
          if (!d.depth) return 0.1;
          return values.includes(d.data.id) || values.includes(d.data.parent) ? 0.8 : 0.1;
        });
    } else {
      d3.select(chartRef.current).selectAll('rect').attr('fill-opacity', 0.6);
      dispatch(setHighlight(null));
    }
  }, [highlight]);

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
        <svg className="chartSVG" viewBox={`0 0 ${width} ${height}`} ref={chartRef} fontSize="10" />
      </div>
    </div>
  );
  return (
    <div>
      <ErrorBoundary>{renderer}</ErrorBoundary>
    </div>
  );
}

const format = d3.format('.2f');

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

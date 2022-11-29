import * as d3 from 'd3';
import * as React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useAppSelector} from '../../hooks';
import {selectedHighlightSelector, Highlight, setHighlight} from '../dataflow/highlightSlice';
import {State} from '../../constants/default-state';
import {selectedValuesSelector} from '../dataflow/selectionSlice';
import {Popup} from '../../components/popup';
import {None} from 'vega';
import ErrorBoundary from '../../components/error-boundary';
import {Hover, hoverSelector, setHover} from '../dataflow/hoverSlice';

let focusLevel = 0;

export function Flame() {
  const selectedValues = useAppSelector(selectedValuesSelector);
  const allPulses = useAppSelector((state) => state.pulses);
  const highlight: Highlight = useAppSelector(selectedHighlightSelector);
  const hover: Hover = useAppSelector(hoverSelector);

  const view = useSelector<State>((state) => state.view);
  const mapping = view['mapping'];

  const pulse_1 = allPulses.length ? allPulses[0] : null;

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
                time: selectedValues[op]['value'].time ? selectedValues[op]['value'].time : 0,
                value: selectedValues[op]['value'].time + 0.01,
              });
            }
          } else {
            if (pulse_1.values[op]) {
              flameInput.push({
                id: op,
                parent: path_str,
                time: pulse_1.values[op]['value'].time ? pulse_1.values[op]['value'].time : 0,
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
    // to calculate the sum of time by post-order traversal
    // reference: https://github.com/d3/d3-hierarchy#node_sum
    function sum_time(value) {
      return root.eachAfter(function (node) {
        let sum = +value(node.data) || 0;
        const children = node.children;
        let i = children && children.length;
        while (--i >= 0) sum += children[i]['time'];
        node['time'] = sum;
      });
    }

    // because we want to display nodes with time = 0,
    // d.value is for calculate rect coordinates
    // d.time is the actual time
    const root = d3.hierarchy(data).sum((d: any) => d.value);
    sum_time((d) => d['time']);
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

  const data = React.useMemo(() => {
    if (tree_data) return partition(tree_data);
    return null;
  }, [tree_data]);

  const labelVisible = (d) => {
    return (
      d.y1 <= height &&
      d.x0 >= 0 &&
      (d.x1 - d.x0 > 50 || (d.x1 - d.x0 > 20 && (d.data ? `${d.data.id}` : stripId(d.id)).length < 10))
    );
  };
  const rectWidth = (d) => {
    return d.x1 - d.x0 - Math.min(1, (d.x1 - d.x0) / 2);
  };

  const stripId = (id: string) => {
    // strip the id so that we don't have awkward-looking strings here
    const result = `${id}`.replace(/^(.*[[])/, ''); // remove all up to last [
    return result.replace(/"|\]/g, ''); // replace all " and ] characters
  };

  const zoom = (p) => {
    focusLevel = p.depth;

    data.each(
      (d: any) =>
        (d.target = {
          x0: ((d.x0 - p.x0) / (p.x1 - p.x0)) * width,
          x1: ((d.x1 - p.x0) / (p.x1 - p.x0)) * width,
          y0: d.y0 - p.y0,
          y1: d.y1 - p.y0,
        })
    );

    const transition = d3
      .select(chartRef.current)
      .selectAll('g')
      .transition()
      .duration(750)
      .attr('transform', (d: any) => `translate(${d.target.x0},${d.target.y0})`);
    svg
      .selectAll('rect')
      .transition(transition)
      .attr('width', (d: any) => rectWidth(d.target));
    svg
      .selectAll('text')
      .transition(transition)
      .attr('fill-opacity', (d: any) => +labelVisible(d.target));
    svg
      .selectAll('tspan')
      .transition(transition)
      .attr('fill-opacity', (d: any) => (labelVisible(d.target) as any) * 0.7);
  };

  const zoomOut = () => {
    zoom(data);
    dispatch(setHighlight(null));
  };

  React.useEffect(() => {
    if (parents.length != 0) {
      // const color = d3.scaleOrdinal(d3.quantize(d3.scaleSequential(['grey', '#007bff']), parents.length + 1));
      const color = d3.scaleOrdinal(d3.quantize(d3.scaleSequential(['#EBF4FA', '#007bff']), parents.length + 1));

      const clicked = (event, p) => {
        zoom(p);
        dispatch(setHighlight({...hoverRef.current, source: 'flame'}));
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

      const onHover = (d, i) => {
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

      svg.on('dblclick', zoomOut);

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
        .text((d: any) => `${format(d.time)}`);

      text.append('tspan').attr('fill-opacity', (d: any) => (labelVisible(d) as any) * 0.7);

      cell.append('title').text((d: any) => `${deriveId(d.data)}\ntime: ${format(d.time)} ms`);
    }
  }, [chartRef.current, data]);

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
          // zoom in
          if (highlight.target == d.data.id && highlight.source != 'flame') zoom(d);
          return values.includes(d.data.id) || values.includes(d.data.parent) ? 0.8 : 0.1;
        });
    } else {
      d3.select(chartRef.current).selectAll('rect').attr('fill-opacity', 0.6);
    }
  }, [chartRef.current, highlight]);

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

  data.forEach((dataPoint) => {
    if ('parent' in dataPoint) {
      if (!data[dataMap[dataPoint.parent]].children) {
        data[dataMap[dataPoint.parent]].children = [];
      }
      data[dataMap[dataPoint.parent]].children.push(dataPoint);
    } else {
      nestData.push(dataPoint);
    }
  });
  return nestData;
};

import * as React from 'react';
import {Pulses, TotalRuntime} from '../dataflow/Sidebar';
import './PerfViewer.css';
import {Flame} from './FlameChart';
import {useRecomputeLayout} from '../dataflow/layoutSlice';
import {Cytoscape} from '../dataflow/Cytoscape';
import {Popup} from '../dataflow/Popup';
import {NodesList} from '../dataflow/NodesList';

/**
 * Wrap the component so we can catch the errors. We don't use the previously defined
 * error boundary component, since we want to seperate errors in graph generation from
 * errors in spec rendering
 * **/
export class PerfViewer extends React.Component<
  Record<string, never>,
  {
    error: Error | null;
  }
> {
  state = {
    error: null,
  };
  public componentDidCatch(error: Error) {
    this.setState({error});
  }

  public render() {
    if (this.state.error) {
      return <div id="error-indicator">{this.state.error.message}</div>;
    }

    return (
      <div className="perf-pane">
        <div className="sidebar">
          <TotalRuntime />
          <Pulses />
          <NodesList />
        </div>
        <div className="perf-chart">
          <FlameChart />
          <Graph />
        </div>
      </div>
    );
  }
}

export function Graph() {
  // Trigger starting the async layout computation, when this node is rendered
  useRecomputeLayout();
  const cytosc = React.useMemo(() => <Cytoscape />, []);
  return (
    <div className="chart">
      {cytosc}
      <Popup />
    </div>
  );
}

export function FlameChart() {
  const flame_chart = React.useMemo(() => <Flame />, []);

  return <div className="flame-chart">{flame_chart}</div>;
}

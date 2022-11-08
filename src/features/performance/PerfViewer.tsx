import * as React from 'react';
import {Pulses} from '../dataflow/Sidebar';
import './PerfViewer.css';
import {Flame} from './FlameChart';
import {useRecomputeLayout} from '../dataflow/layoutSlice';
import {Cytoscape} from '../dataflow/Cytoscape';

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
          <Pulses />
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
  const cytoscape = React.useMemo(() => <Cytoscape />, []);
  return <div className="graph">{cytoscape}</div>;
}

export function FlameChart() {
  const flame_chart = React.useMemo(() => <Flame />, []);

  return <div>{flame_chart}</div>;
}

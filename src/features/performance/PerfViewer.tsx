import * as React from 'react';
import {Pulses} from '../dataflow/Sidebar';
import './PerfViewer.css';
import FlameChart from './FlameChart';

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
        <FlameChart />
      </div>
    );
  }
}

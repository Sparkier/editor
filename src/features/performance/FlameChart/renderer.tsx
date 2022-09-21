import * as React from 'react';
import {useDispatch} from 'react-redux';

import ReactPaginate from 'react-paginate';
import Select from 'react-select';
import * as vega from 'vega';
import {debounce, Spec} from 'vega';
import {mapStateToProps} from '.';
import {Popup} from '../../../components/popup';
import ErrorBoundary from '../../../components/error-boundary';
import vegaTooltip from 'vega-tooltip';

// import './index.css';

type StoreProps = ReturnType<typeof mapStateToProps>;

// interface OwnComponentProps {
//   onClickHandler: (header: string) => void;
// }

// type Props = StoreProps & OwnComponentProps;
type Props = StoreProps;

const initialState = {
  currentPage: 0,
  selectedData: '',
  flameView: null,
};

type State = Readonly<typeof initialState>;

export default class FlameChart extends React.PureComponent<Props, State> {
  public readonly state: State = initialState;

  private debouncedDataChanged: () => void;
  // public chart:React.RefObject<unknown>;

  constructor(props) {
    super(props);
    // this.chart = React.createRef();
    // this.handleChange = this.handleChange.bind(this);
    // this.handlePageChange = this.handlePageChange.bind(this);
    // this.debouncedDataChanged = debounce(100, () => {
    //   this.forceUpdate();
    // });
  }

  // public handleChange(option) {
  //   this.setState({selectedData: option.value, currentPage: 0});
  // }

  // public handlePageChange(option) {
  //   const selected = option.selected;
  //   this.setState({currentPage: selected});
  // }

  public getDatasets() {
    const mapping = this.props.view['mapping'];
    // const queue = [];
    // const flameInput = []

    // for (const [key, value] of Object.entries(vegaSpec)) {
    //   flameInput.push({id: key, })
    //   queue.push(value);
    // }

    // while (queue.length) {
    //   const parent = queue.shift()
    // }
  }

  // public setDefaultDataset() {
  //   const datasets = this.getDatasets();

  //   if (datasets.length) {
  //     this.setState({
  //       currentPage: 0,
  //       selectedData: datasets[datasets.length > 1 ? 1 : 0],
  //     });
  //   }
  // }

  public componentDidMount() {
    // this.setDefaultDataset();

    // this.props.editorRef.onMouseDown(function (e) {
    //   console.log(e)
    //     // showEvent('mousedown - ' + e.target.toString());
    // });
    this.renderFlameChart();
  }

  // public componentWillUnmount() {
  //   if (this.state.selectedData) {
  //     this.props.view.removeDataListener(this.state.selectedData, this.debouncedDataChanged);
  //   }
  // }

  public componentDidUpdate(prevProps: Props, prevState: State) {
    // if (this.props.view !== prevProps.view) {
    //   this.renderFlameChart();
    //   // const datasets = this.getDatasets();
    //   // if (datasets.indexOf(this.state.selectedData) === -1) {
    //   //   // the new view has different dataset so let's reset everything
    //   //   this.setState(initialState);
    //   // } else {
    //   //   // the new view has the same dataset so let's not change the state but add a new listener
    //   //   this.props.view.addDataListener(this.state.selectedData, this.debouncedDataChanged);
    //   // }
    //   // return;
    // }
    // if (this.state.selectedData === '') {
    //   this.setDefaultDataset();
    // } else if (this.state.selectedData !== prevState.selectedData) {
    //   if (prevState.selectedData) {
    //     this.props.view.removeDataListener(prevState.selectedData, this.debouncedDataChanged);
    //   }
    //   this.props.view.addDataListener(this.state.selectedData, this.debouncedDataChanged);
    // }
  }

  public async renderFlameChart() {
    console.log(this.props.vegaSpec);

    const flame_template: Spec = {
      $schema: 'https://vega.github.io/schema/vega/v5.json',
      description: 'An example of a space-fulling radial layout for hierarchical data.',
      width: 1600,
      height: 300,
      padding: 5,
      autosize: 'none',
      data: [
        {
          name: 'tree',
          url: 'data/flare.json',
          transform: [
            {type: 'stratify', key: 'id', parentKey: 'parent'},
            {
              type: 'partition',
              field: 'size',
              sort: {field: 'id'},
              size: [{signal: 'width'}, {signal: 'height'}],
            },
          ],
        },
      ],
      scales: [
        {
          name: 'color',
          type: 'ordinal',
          domain: {data: 'tree', field: 'depth'},
          range: {scheme: 'tableau20'},
        },
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
              fill: {scale: 'color', field: 'depth'},
              stroke: {value: '#fff'},
              tooltip: {
                signal: "datum.name + (datum.size ? ', ' + datum.size + ' bytes' : '')",
              },
            },
            update: {fill: {scale: 'color', field: 'depth'}},
            hover: {
              fill: {value: 'red'},
              strokeWidth: {value: 2},
              zindex: {value: 1},
            },
          },
        },
      ],
    };
    // const chart = this.chart as any;
    const chart = this.refs.chart as any;
    const runtime = vega.parse(flame_template);
    const view = new vega.View(runtime, {hover: true});
    view.renderer(this.props.renderer).initialize(chart);
    await view.runAsync();

    // Tooltip needs to be added after initializing the view with `chart`
    vegaTooltip(view);

    // view.runAfter(v => {
    //   this.setState({flameView: v})
    // })
  }

  public render() {
    // this.renderFlameChart();
    if (this.state.flameView) {
      return (
        <div>
          <div className="chart" style={{backgroundColor: this.props.backgroundColor}}>
            <Popup
              content={`Click on "Continue Recording" to make the chart interactive`}
              placement="right"
              // Make skinnier so it fits on the right side of the chart
              maxWidth={200}
            >
              <div className="chart-overlay"></div>
            </Popup>
            <div aria-label="visualization" ref="chart" style={{}} />
            {/* <svg width="10" height="10">
              <path d="M-2,13L13,-2 M-2,16L16,-2 M-2,19L19,-2" />
            </svg> */}
          </div>
        </div>
      );
    } else {
      const renderer = (
        <div className="chart" style={{backgroundColor: this.props.backgroundColor}}>
          <Popup
            content={`Click on "Continue Recording" to make the chart interactive`}
            placement="right"
            // Make skinnier so it fits on the right side of the chart
            maxWidth={200}
          >
            <div className="chart-overlay"></div>
          </Popup>
          <div aria-label="visualization" ref="chart" style={{}} />
          <div className="chart-resize-handle">
            <svg width="10" height="10">
              <path d="M-2,13L13,-2 M-2,16L16,-2 M-2,19L19,-2" />
            </svg>
          </div>
        </div>
      );
      return (
        <div>
          <div className="chart-container">
            <ErrorBoundary>{renderer}</ErrorBoundary>
          </div>
        </div>
      );
    }
  }

  //   public render() {
  //     const datasets = this.getDatasets();
  //     if (datasets.length === 0) {
  //       return <div className="data-viewer">Spec has no data</div>;
  //     }

  //     datasets.push(datasets.shift()); // Move root to the end

  //     let selected = this.state.selectedData;
  //     if (datasets.indexOf(selected) < 0) {
  //       selected = datasets[0];
  //     }

  //     let pagination: React.ReactElement;

  //     const data = this.props.view.data(selected) || [];

  //     const pageCount = Math.ceil(data.length / ROWS_PER_PAGE);

  //     if (pageCount > 1) {
  //       pagination = (
  //         <ReactPaginate
  //           previousLabel={'<'}
  //           nextLabel={'>'}
  //           breakClassName={'break'}
  //           pageCount={pageCount}
  //           marginPagesDisplayed={1}
  //           pageRangeDisplayed={3}
  //           onPageChange={this.handlePageChange}
  //           containerClassName={'pagination'}
  //           activeClassName={'active'}
  //         />
  //       );
  //     }

  //     const start = ROWS_PER_PAGE * this.state.currentPage;
  //     const end = start + ROWS_PER_PAGE;

  //     const visibleData = data.slice(start, end);

  //     const table = data.length ? (
  //       <Table
  //         onClickHandler={(header) => this.props.onClickHandler(header)}
  //         header={Object.keys(data[0])}
  //         data={visibleData}
  //       />
  //     ) : (
  //       <span className="error">The table is empty.</span>
  //     );

  //     return (
  //       <>
  //         <div className="data-viewer-header">
  //           <Select
  //             className="data-dropdown"
  //             value={{label: selected, value: selected}}
  //             onChange={this.handleChange}
  //             options={datasets.map((d) => ({
  //               label: d,
  //               value: d,
  //             }))}
  //             isClearable={false}
  //             isSearchable={true}
  //           />
  //           <div className="pagination-wrapper">{pagination}</div>
  //         </div>
  //         <div className="data-table">
  //           <ErrorBoundary>{table}</ErrorBoundary>
  //         </div>
  //       </>
  //     );
  //   }
}

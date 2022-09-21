// import * as React from 'react';
// import {AnyAction} from '@reduxjs/toolkit';
// import {State} from '../../constants/default-state';

// import {pulsesSlice} from '../dataflow/pulsesSlice';
// import {runtimeSlice} from '../dataflow/runtimeSlice';
// import {selectionSlice} from '../dataflow/selectionSlice';
// import {layoutSlice} from '../dataflow/layoutSlice';
// import {popupSlice} from '../dataflow/popupSlice';

// // Since we are using a number of pulses defined here with the rest of the global redux state
// // we need a few custom functions to combine these reducers and state types, to integrate
// // them into the rest of the redux state.

// const slices = [pulsesSlice, runtimeSlice, selectionSlice, layoutSlice, popupSlice] as const;
// import {connect} from 'react-redux';
// import {State} from '../../constants/default-state';
// import {PerfViewer} from './PerfViewer';
// import Renderer from './Flame'

// export function mapStateToProps(state: State) {
//   return {
//     editorRef: state.editorRef,
//     view: state.view,
//   };
// }

// export default connect(mapStateToProps)(Renderer);

import {createAction, createSelector, createSlice} from '@reduxjs/toolkit';
import {createSliceSelector} from './utils/createSliceSelector';

export type Highlight = {path: string; ids: string[]};
export type HighlightState = Highlight;
const initialState: HighlightState = {path: null, ids: []};

export const setHighlight = createAction<Highlight>('setHighlight');

export const highlightSlice = createSlice({
  name: 'highlight',
  initialState,
  reducers: {},
  extraReducers: (builder) => builder.addCase(setHighlight, (state, {payload}) => payload),
});

export const selectionSelector = createSliceSelector(highlightSlice);
export const selectedHighlightSelector = createSelector(selectionSelector, (state) => state);

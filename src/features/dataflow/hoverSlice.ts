import {createAction, createSelector, createSlice} from '@reduxjs/toolkit';
import {createSliceSelector} from './utils/createSliceSelector';

export type Hover = {paths: string[]; ids: string[]; selected?; target?; source?: string};
export type HoverState = Hover | null;
// const initialState: HighlightState = {path: null, ids: []};
const initialState: HoverState = null;

export const setHover = createAction<Hover>('setHover');

export const hoverSlice = createSlice({
  name: 'hover',
  initialState,
  reducers: {},
  extraReducers: (builder) => builder.addCase(setHover, (state, {payload}) => payload),
});

export const hoverSelectionSelector = createSliceSelector(hoverSlice);
export const hoverSelector = createSelector(hoverSelectionSelector, (state) => state);

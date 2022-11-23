import {createAction, createSlice, createSelector} from '@reduxjs/toolkit';
import {createSliceSelector} from './utils/createSliceSelector';

export const setDataflowColoring = createAction<string>('setDataflowColoring');

export const coloringSlice = createSlice({
  name: 'dataflowColoring',
  initialState: 'time',
  reducers: {},
  extraReducers: (builder) => builder.addCase(setDataflowColoring, (_, {payload}) => payload),
});

export const selectionSelector = createSliceSelector(coloringSlice);
export const selectedColoringSelector = createSelector(selectionSelector, (state) => state);

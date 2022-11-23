import {createAction, createSlice, createSelector} from '@reduxjs/toolkit';
import {createSliceSelector} from './utils/createSliceSelector';

export const setTimingRange = createAction<{min: number; max: number}>('setTimingRange');

export const timingRangeSlice = createSlice({
  name: 'timingRange',
  initialState: {min: Number.MIN_VALUE, max: Number.MAX_VALUE},
  reducers: {},
  extraReducers: (builder) => builder.addCase(setTimingRange, (_, {payload}) => payload),
});

export const selectionSelector = createSliceSelector(timingRangeSlice);
export const selectedTimingRangeSelector = createSelector(selectionSelector, (state) => state);

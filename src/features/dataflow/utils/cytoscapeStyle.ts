import * as d3 from 'd3';
import {Values} from './../pulsesSlice';
import {scheme} from 'vega-scale';
import {colorKeys} from './graph';

// Use these color schemes for the nodes
// https://vega.github.io/vega/docs/schemes/#categorical
const colorScheme: string[] = [...scheme('tableau20'), ...scheme('category20b')];
// Copy --base-font-family but remove BlinkMacSystemFont because of Chrome bug that cytoscape hits
// https://bugs.chromium.org/p/chromium/issues/detail?id=1056386#c12

export const fontFamily = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const fontSize = '16px';
export const nodePaddingPx = 8;

export const style = (values: Values | null): cytoscape.Stylesheet[] => {
  let colors: {selector: string; style: {'background-color': string}}[] = [];
  if (values) {
    const time = Object.entries(values).map((v) => {
      return v[1]['value'].time as number;
    });
    const max = Math.max(...time);

    colors = Object.entries(values).map((key) => {
      console.log(key);
      return {
        selector: `node[id="${key[0]}"]`,
        style: {
          'background-color': 'red',
          'background-opacity': 0.05 + (key[1]['value'].time / max) * 0.7,
        }, // Color opacity scale based on key[1].value.time. range: [0.05, 0.75]
      };
    });
  } else {
    colors = colorKeys.map((t, i) => ({
      selector: `node[colorKey=${JSON.stringify(t)}]`,
      style: {'background-color': colorScheme[i % colorScheme.length]},
    }));
  }
  return [
    {
      selector: 'node, edge',
      style: {
        'font-family': fontFamily,
        'font-size': fontSize,
        'min-zoomed-font-size': 10,
        'overlay-padding': 10,
      },
    },
    {
      // Increase active opacity so more visible
      selector: ':active',
      style: {
        'overlay-opacity': 0.5,
      },
    },
    {
      selector: 'node',
      style: {
        // Labels
        'text-wrap': 'wrap',
        'text-valign': 'center',
        'text-halign': 'center',

        'background-opacity': 0.6,
        shape: 'round-rectangle',
        width: 'data(width)',
        height: 'data(height)',
        label: 'data(label)',
        padding: `${nodePaddingPx}px`,
        color: 'black',
      } as any,
    },
    {
      selector: '.highlightNodes',
      style: {
        'border-color': '#0066cc',
        'border-width': '8',
      },
    },
    {
      selector: '.hoverNodes',
      style: {
        'underlay-color': '#0066cc',
        'underlay-opacity': 0.5,
      },
    },
    {
      selector: '.littleRuntimeNodes',
      style: {
        'background-opacity': 0.1,
        'text-opacity': 0.5,
      },
    },
    {
      selector: ':parent',
      style: {
        'text-valign': 'top',
        'background-opacity': 0.05,
      },
    },
    {
      selector: 'edge',
      css: {
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'text-background-padding': '5',
        'text-background-shape': 'round-rectangle' as any,
        'text-background-color': 'white',
        'text-background-opacity': 1,
        'text-rotation': 'autorotate',
        width: 1,
      },
    },
    {
      selector: 'edge[label]',
      css: {
        label: 'data(label)',
      },
    },
    {
      selector: 'edge[primary="true"]',
      css: {
        color: 'black',
        'line-color': 'black',
        'target-arrow-color': 'black',
      },
    },
    {
      selector: 'edge[primary="false"]',
      css: {
        color: '#ddd',
        'line-color': '#ddd',
        'target-arrow-color': '#ddd',
      },
    },
    ...colors,
  ];
};

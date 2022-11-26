import {NodeDefinition} from 'cytoscape';
import * as React from 'react';
import {useDispatch} from 'react-redux';
import {useAppSelector} from '../../hooks';
import {Hover, hoverSelector, setHover} from '../dataflow/hoverSlice';
import {Highlight, selectedHighlightSelector, setHighlight} from './highlightSlice';
import './NodesList.css';
import {Values} from './pulsesSlice';

function roundNumber(num, dec) {
  const result = Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
  return result;
}

export function NodesList({values, nodes}: {values: Values; nodes: NodeDefinition[]}) {
  const highlight: Highlight = useAppSelector(selectedHighlightSelector);
  const hover: Hover = useAppSelector(hoverSelector);
  const [nodesList, setNodesList] = React.useState([]);

  React.useEffect(() => {
    const currentNodes = [];
    for (const [key, value] of Object.entries(values)) {
      const currentNode = nodes.find((node) => node.data.id === key);
      if (currentNode) {
        currentNodes.push({id: key, time: roundNumber(value['value'].time, 3), node: currentNode});
      }
    }
    setNodesList(currentNodes.sort((a, b) => b.time - a.time));
  }, [values, nodes]);

  return (
    <div className="list-container">
      <table className="editor-table">
        <thead>
          <tr>
            <th>Id</th>
            <th>Name</th>
            <th>Time(ms)</th>
          </tr>
        </thead>
        <tbody>
          {nodesList.map((node) => (
            <MemoNode
              key={node.id}
              time={node.time}
              id={node.id}
              label={node.node.data.label}
              hover={hover}
              highlight={highlight}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const MemoNode = React.memo(Node);

function Node({
  time,
  id,
  label,
  highlight,
  hover,
}: {
  id: string;
  time: number;
  label: string;
  highlight: Highlight | null;
  hover: Hover | null;
}) {
  const dispatch = useDispatch();
  const className = () => {
    let hoverClass = '';
    let highlightClass = '';
    if (hover) {
      if (hover.ids.includes(id)) {
        hoverClass = 'hovered-node';
      }
    }
    if (highlight) {
      if (highlight.ids.includes(id)) {
        highlightClass = 'highlighted-node';
      }
    }
    return `${hoverClass} ${highlightClass}`;
  };

  return (
    <tr
      className={className()}
      onMouseEnter={() => {
        dispatch(setHover({paths: [id], ids: [id]}));
      }}
      onMouseLeave={() => {
        dispatch(setHover({paths: [], ids: []}));
      }}
      onClick={() => {
        dispatch(setHighlight({paths: [id], ids: [id]}));
      }}
    >
      <td>{id}</td>
      <td>{label}</td>
      <td>{time}</td>
    </tr>
  );
}

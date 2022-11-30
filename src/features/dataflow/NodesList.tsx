import * as React from 'react';
import {useDispatch} from 'react-redux';
import {useAppSelector} from '../../hooks';
import {Hover, hoverSelector, setHover} from '../dataflow/hoverSlice';
import {Highlight, selectedHighlightSelector, setHighlight} from './highlightSlice';
import './NodesList.css';
import {cytoscapeElementsSelector} from './runtimeSlice';
import {selectedValuesSelector} from './selectionSlice';

function roundNumber(num, dec) {
  const result = Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
  return result;
}

export function NodesList() {
  const values = useAppSelector(selectedValuesSelector);
  const elements = useAppSelector(cytoscapeElementsSelector);
  const highlight: Highlight = useAppSelector(selectedHighlightSelector);
  const hover: Hover = useAppSelector(hoverSelector);
  const [nodesList, setNodesList] = React.useState([]);
  const [filteredNodesList, setFilteredNodesList] = React.useState([]);

  React.useEffect(() => {
    if (values) {
      const currentNodes = [];
      for (const [key, value] of Object.entries(values)) {
        const currentNode = elements.nodes.find((node) => node.data.id === key);
        if (currentNode) {
          currentNodes.push({id: key, time: roundNumber(value['value'].time, 3), node: currentNode});
        }
      }
      setNodesList(currentNodes.sort((a, b) => b.time - a.time));
    } else {
      setNodesList([]);
    }
  }, [values, elements]);

  React.useEffect(() => {
    if (highlight && highlight.ids.length > 0) {
      setFilteredNodesList(nodesList.filter((value) => highlight.ids.includes(value.id)));
    } else {
      setFilteredNodesList(nodesList);
    }
  }, [highlight, nodesList]);

  return (
    <>
      {nodesList && (
        <fieldset className="node-list-fields">
          <legend>Dataflow Nodes</legend>
          <div className="list-container">
            <p>These nodes are ordered by runtime and filtered based on your selection.</p>
            <NodesButtons />
            <table className="editor-table">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Name</th>
                  <th>Time(ms)</th>
                </tr>
              </thead>
              <tbody>
                {filteredNodesList.map((node) => (
                  <MemoNode key={node.id} time={node.time} id={node.id} label={node.node.data.label} hover={hover} />
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      )}
    </>
  );
}

const MemoNode = React.memo(Node);

function Node({time, id, label, hover}: {id: string; time: number; label: string; hover: Hover | null}) {
  const dispatch = useDispatch();

  return (
    <tr
      className={hover && hover.ids.includes(id) ? 'hovered-node' : ''}
      onMouseEnter={() => {
        dispatch(setHover({paths: [id], ids: [id]}));
      }}
      onMouseLeave={() => {
        dispatch(setHover(null));
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

function NodesButtons() {
  const dispatch = useDispatch();
  return (
    <div className="buttons">
      <button onClick={() => dispatch(setHighlight(null))}>Unselect Nodes</button>
    </div>
  );
}

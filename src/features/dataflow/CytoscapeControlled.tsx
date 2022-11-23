import cytoscape, {CytoscapeOptions} from 'cytoscape';
import * as React from 'react';
import {Elements} from './utils/allRelated';
import popper from 'cytoscape-popper';
import {style} from './utils/cytoscapeStyle';
import {Positions} from './utils/ELKToPositions';
import './CytoscapeControlled.css';
import {setsEqual} from './utils/setsEqual';
import {Highlight} from './highlightSlice';
import {Hover} from './hoverSlice';
import {PulsesState, Values} from './pulsesSlice';

cytoscape.use(popper);

// https://js.cytoscape.org/#core/initialisation
const OPTIONS = (values: Values | null): CytoscapeOptions => {
  return {
    style: style(values), // (values),
    // Make zoom more constrained than default so we don't get lost
    minZoom: 1e-2,
    maxZoom: 1e1,
  };
};

/**
 * A controlled Cytoscape component, which is meant to be rendered once with a given set of elements and list of visible
 * nodes, and then re-rendered updating the positions and which elements are visible, before being re-rendered with new elements.
 */
export function CytoscapeControlled({
  elements,
  positions,
  selected,
  onHover,
  onSelect,
  highlight,
  hoverByFlame,
  perfHover,
  values,
}: {
  elements: cytoscape.ElementsDefinition | null;
  // Mapping of each visible node to its position, the IDs being a subset of the `elements` props
  positions: Positions | null;
  selected: Elements | null;
  onSelect: (elements: Elements | null) => void;
  onHover: (target: null | {type: 'node' | 'edge'; id: string; referenceClientRect: DOMRect}) => void;
  highlight: Highlight | null;
  hoverByFlame: Hover | null;
  perfHover: (target: any) => {payload: Hover; type: string};
  values: Values;
}) {
  const divRef = React.useRef<HTMLDivElement | null>(null);
  const cyRef = React.useRef<cytoscape.Core | null>(null);
  const layoutRef = React.useRef<cytoscape.Layouts | null>(null);
  // The elements that have been removed, from a selection
  const removedRef = React.useRef<cytoscape.CollectionReturnValue | null>(null);
  const getRemovedNodeIDs = () => new Set(removedRef.current?.map((n) => n.id()) ?? []);

  // Set cytoscape ref in first effect and set up callbacks
  React.useEffect(() => {
    const cy = (cyRef.current = cytoscape({container: divRef.current, ...OPTIONS(values)}));
    layoutRef.current = cy.makeLayout({name: 'preset'});
    removedRef.current = null;
    cy.on('select', (event) => {
      event.preventDefault();
      onSelect({
        edges: cy.edges(':selected').map((e) => e.id()),
        nodes: cy.nodes(':selected').map((n) => n.id()),
      });
    });
    cy.on('unselect', (event) => {
      event.preventDefault();
    });
    // Unselect when clicking on background
    // We need this extra handler, instead of just relying on "unselect", because we can have a node semantically selected,
    // but not visible anymore, so that cytoscope doesn't consider it selected
    cy.on('click', ({target}) => {
      if (target === cy) {
        onSelect(null);
        cy.nodes('node').removeClass('highlightNodes');
      }
    });
    cy.on('mouseover', ({target}) => {
      if (target === cy) {
        // mouseover background
        return;
      }
      onHover({
        type: target.isNode() ? 'node' : 'edge',
        id: target.id(),
        referenceClientRect: target.popperRef().getBoundingClientRect(),
      });
      if (target.isNode()) {
        perfHover({
          paths: [],
          ids: [target.id()],
        });
      }
    });
    cy.on('mouseout', ({target}) => {
      if (target === cy) {
        return;
      }
      onHover(null);
      perfHover(null);
    });
    return () => {
      cy.destroy();
      onHover(null);
      perfHover(null);
    };
  }, [divRef.current, onHover, onSelect]);

  // Update the elements
  React.useEffect(() => {
    const cy = cyRef.current;

    // Toggle off hovering when changing elements
    onHover(null);

    cy.batch(() => {
      // Delete all old new elements, add new ones, and reset temporarily
      // removed elements reference
      cy.elements().remove();
      if (elements === null) {
        removedRef.current = null;
      } else {
        // Remove all the new elements after adding,
        // so that when their layouts are updated, they aren't animated,
        // since they were previously off screen
        removedRef.current = cy.add(elements).remove();
      }
    });
  }, [cyRef.current, elements]);

  // Update the positions
  React.useEffect(() => {
    const layout = layoutRef.current;
    layout.stop();
    if (positions === null) {
      return;
    }

    const cy = cyRef.current;

    // Record nodes we will restore, so don't animate them
    const restoredNodeIDs = getRemovedNodeIDs();

    // Restore all previously removed nodes
    if (removedRef.current) {
      removedRef.current.restore();
    }
    // Remove all nodes that don't have positions
    removedRef.current = cy
      .collection(Object.keys(positions).map((id) => cy.$id(id)))
      .absoluteComplement()
      .nodes()
      .remove();

    // If the previously removed nodes are equal to the current removed nodes, dont layout,
    // the nodes haven't changed
    if (setsEqual(restoredNodeIDs, getRemovedNodeIDs())) {
      return;
    }

    // Toggle off hovering when moving positions
    onHover(null);
    // Update the layouts
    const allNodes = cy.nodes();

    const wasNotRestored = (n: cytoscape.NodeSingular) => !restoredNodeIDs.has(n.id());
    // Only animate fit if there are some nodes that weren't restored
    const animate = allNodes.some(wasNotRestored);

    (cy.nodes() as any).layoutPositions(
      layout,
      {
        eles: allNodes,
        fit: true,
        animate,
        animationDuration: 1500,
        animationEasing: 'ease-in-out-sine',
        padding: 10,
        // Only animate if the node was not just restored, b/c just restored
        // nodes positions aren't meaningful
        animateFilter: wasNotRestored,
      } as any,
      (node) => positions[node.id()]
    );
  }, [cyRef.current, positions, onHover]);

  // Update the selected elements
  React.useEffect(() => {
    const cy = cyRef.current;
    cy.batch(() => {
      const selectedElements = cy.collection(
        selected ? [...selected.edges, ...selected.nodes].map((id) => cy.$id(id)) : []
      );
      selectedElements.select();
      selectedElements.absoluteComplement().unselect();
    });
  }, [cyRef.current, selected]);

  // set highlight to chosen nodes
  React.useEffect(() => {
    const cy = cyRef.current;
    cy.nodes('node').removeClass('highlightNodes');

    if (highlight) {
      highlight.ids.forEach((id) => {
        cy.elements(`node[id = "${id}"]`).addClass('highlightNodes');
      });
      if (highlight.target) onSelect({nodes: highlight.ids, edges: []});
    } else {
      onSelect(null);
    }
  }, [cyRef.current, highlight]);

  React.useEffect(() => {
    const cy = cyRef.current;
    cy.nodes('node').removeClass('hoverNodes');

    if (hoverByFlame) {
      hoverByFlame.ids.forEach((id) => {
        cy.elements(`node[id = "${id}"]`).addClass('hoverNodes');
      });
    }
  }, [cyRef.current, hoverByFlame]);

  React.useEffect(() => {
    const cy = cyRef.current;
    cy.style(style(values));
  }, [cyRef.current, values]);

  return <div className="cytoscape" ref={divRef} />;
}

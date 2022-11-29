import stringify from 'json-stringify-pretty-compact';
import LZString from 'lz-string';
import * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';
import MonacoEditor from 'react-monaco-editor';
import ResizeObserver from 'rc-resize-observer';
import {RouteComponentProps, withRouter} from 'react-router-dom';
import {debounce} from 'vega';
import parser from 'vega-schema-url-parser';
import {mapDispatchToProps, mapStateToProps} from '.';
import {EDITOR_FOCUS, KEYCODES, Mode, SCHEMA, SIDEPANE} from '../../../constants';
import './index.css';
import {parse as parseJSONC} from 'jsonc-parser';
import {TextDocument} from 'vscode-json-languageservice';
import {getFoldingRanges} from './getRanges';

type Props = ReturnType<typeof mapStateToProps> &
  ReturnType<typeof mapDispatchToProps> &
  RouteComponentProps<{compressed: string}>;

class Editor extends React.PureComponent<Props> {
  public editor: Monaco.editor.IStandaloneCodeEditor;
  public hover: Monaco.IDisposable;
  public prevHoverDecoratorID: string[] = [];
  public prevSelectedDecoratorID: string[] = [];
  constructor(props: Props) {
    super(props);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleEditorChange = this.handleEditorChange.bind(this);
    this.editorWillMount = this.editorWillMount.bind(this);
    this.editorDidMount = this.editorDidMount.bind(this);
    this.onSelectNewVegaLite = this.onSelectNewVegaLite.bind(this);
    this.mouseDownHandler = this.mouseDownHandler.bind(this);
    this.hoverHandler = this.hoverHandler.bind(this);
  }

  public handleKeydown(e) {
    if (this.props.manualParse) {
      if ((e.keyCode === KEYCODES.B || e.keyCode === KEYCODES.S) && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.props.parseSpec(true);
        const parseButton = this.refs.parse as any;
        parseButton.classList.add('pressed');
        setTimeout(() => {
          parseButton.classList.remove('pressed');
        }, 250);
      }
    }
  }

  public mouseDownHandler() {
    this.props.setHighlight(this.props.hover);
    const range = this.props.highlight?.selected;
    if (range) {
      this.prevSelectedDecoratorID = this.decorateRange(this.prevSelectedDecoratorID, range, 'selectedLines');
    } else {
      this.editor.deltaDecorations(this.prevSelectedDecoratorID, []);
      this.props.setHighlight(null);
    }
  }

  public hoverHandler(position: number | undefined) {
    if (!position) this.props.setHover(null);

    // search for the closest startLine
    const min_diff = this.editor.getModel().getLineCount();
    let lineNumber = null;
    for (const range of Object.values(this.props.ranges)) {
      if (range.startLine <= position - 1 && min_diff > position - 1 - range.startLine) {
        lineNumber = range.startLine;
      }
    }

    if (lineNumber in this.props.ranges) {
      const path = this.props.ranges[lineNumber].path;
      const path_str = path
        .map((x) => {
          if (typeof x === 'string') return `["${x}"]`;
          return `[${x}]`;
        })
        .join('');

      const mapping = this.props.view['mapping'];

      const ids = [];
      const paths = [path_str];
      for (const key in mapping) {
        if (key.includes(path_str)) {
          ids.push(...mapping[key]);
          paths.push(key);
        }
      }

      this.props.setHover({paths, ids, selected: this.props.ranges[lineNumber], target: path_str, source: 'editor'});
    }
  }

  public handleMergeConfig() {
    const confirmation = confirm('The spec will be formatted on merge.');
    if (!confirmation) {
      return;
    }
    if (this.props.history.location.pathname !== '/edited') {
      this.props.history.push('/edited');
    }
    this.props.mergeConfigSpec();
  }

  public handleExtractConfig() {
    const confirmation = confirm('The spec and config will be formatted.');
    if (!confirmation) {
      return;
    }

    this.props.extractConfigSpec();
  }

  public onSelectNewVega() {
    this.props.history.push('/custom/vega');
  }

  public onSelectNewVegaLite() {
    this.props.history.push('/custom/vega-lite');
  }

  public onClear() {
    this.props.mode === Mode.Vega ? this.onSelectNewVega() : this.onSelectNewVegaLite();
  }

  public addVegaSchemaURL() {
    let spec = parseJSONC(this.props.editorString);
    if (spec.$schema === undefined) {
      spec = {
        $schema: SCHEMA[Mode.Vega],
        ...spec,
      };
      if (confirm('Adding schema URL will format the specification too.')) {
        this.props.updateVegaSpec(stringify(spec));
      }
    }
  }

  public addVegaLiteSchemaURL() {
    let spec = parseJSONC(this.props.editorString);
    if (spec.$schema === undefined) {
      spec = {
        $schema: SCHEMA[Mode.VegaLite],
        ...spec,
      };
      if (confirm('Adding schema URL will format the specification too.')) {
        this.props.updateVegaLiteSpec(stringify(spec));
      }
    }
  }

  public editorDidMount(editor: Monaco.editor.IStandaloneCodeEditor) {
    editor.onDidFocusEditorText(() => {
      this.props.compiledEditorRef && this.props.compiledEditorRef.deltaDecorations(this.props.decorations, []);
      editor.deltaDecorations(this.props.decorations, []);
      this.props.setEditorFocus(EDITOR_FOCUS.SpecEditor);
    });

    editor.onMouseDown(this.mouseDownHandler);
    editor.onMouseLeave(() => this.hoverHandler(null));

    editor.addAction({
      contextMenuGroupId: 'vega',
      contextMenuOrder: 0,
      id: 'ADD_VEGA_SCHEMA',
      label: 'Add Vega schema URL',
      run: this.addVegaSchemaURL.bind(this),
    });

    editor.addAction({
      contextMenuGroupId: 'vega',
      contextMenuOrder: 1,
      id: 'ADD_VEGA_LITE_SCHEMA',
      label: 'Add Vega-Lite schema URL',
      run: this.addVegaLiteSchemaURL.bind(this),
    });

    editor.addAction({
      contextMenuGroupId: 'vega',
      contextMenuOrder: 2,
      id: 'CLEAR_EDITOR',
      label: 'Clear Spec',
      run: this.onClear.bind(this),
    });

    editor.addAction({
      contextMenuGroupId: 'vega',
      contextMenuOrder: 3,
      id: 'MERGE_CONFIG',
      label: 'Merge Config Into Spec',
      run: this.handleMergeConfig.bind(this),
    });

    editor.addAction({
      contextMenuGroupId: 'vega',
      contextMenuOrder: 4,
      id: 'EXTRACT_CONFIG',
      label: 'Extract Config From Spec',
      run: this.handleExtractConfig.bind(this),
    });

    editor.getModel().getOptions();

    this.editor = editor;

    if (this.props.sidePaneItem === SIDEPANE.Editor) {
      editor.focus();
      editor.layout();
      this.props.setEditorFocus(EDITOR_FOCUS.SpecEditor);
    }
  }

  public handleEditorChange(spec: string) {
    this.props.manualParse ? this.props.updateEditorString(spec) : this.updateSpec(spec);

    if (this.props.history.location.pathname.indexOf('/edited') === -1) {
      this.props.history.push('/edited');
    }
  }

  public editorWillMount() {
    const compressed = this.props.match.params.compressed;
    if (compressed) {
      let spec: string = LZString.decompressFromEncodedURIComponent(compressed);

      if (spec) {
        const newlines = (spec.match(/\n/g) || '').length + 1;
        if (newlines <= 1) {
          console.log('Formatting spec string from URL that did not contain newlines.');
          spec = stringify(parseJSONC(spec));
        }

        this.updateSpec(spec);
      } else {
        this.props.logError(new Error(`Failed to decompress URL. Expected a specification, but received ${spec}`));
      }
    }
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.props.sidePaneItem === SIDEPANE.Editor) {
      if (prevProps.sidePaneItem !== this.props.sidePaneItem) {
        this.editor.focus();
        this.editor.layout();
        prevProps.setEditorReference(this.editor);
      }
    }

    if (prevProps.view !== this.props.view) {
      prevProps.compiledEditorRef && prevProps.compiledEditorRef.deltaDecorations(prevProps.decorations, []);
      prevProps.editorRef && prevProps.editorRef.deltaDecorations(prevProps.decorations, []);

      if (this.hover) this.hover.dispose();
      const textDocument = TextDocument.create('', 'json', 1, this.props.value);
      const hoverRanges = getFoldingRanges(textDocument);
      const startLine_to_range = {} as {number: any};
      hoverRanges.map((x) => (startLine_to_range[x.startLine] = x));
      this.props.setRanges(startLine_to_range);
      const setHover = this.hoverHandler;

      this.hover = Monaco.languages.registerHoverProvider('json', {
        provideHover(model, position) {
          setHover(position.lineNumber);
          return null;
        },
      });
    }

    if (this.props.parse) {
      this.editor.focus();
      this.editor.layout();
      this.updateSpec(this.props.value, this.props.configEditorString);
      prevProps.parseSpec(false);
    }

    if (this.props.hover) {
      this.updateHover();
    } else {
      this.editor.deltaDecorations(this.prevHoverDecoratorID, []);
    }

    if (this.props.highlight !== prevProps.highlight) {
      if (!this.props.highlight) {
        this.editor.deltaDecorations(this.prevSelectedDecoratorID, []);
        return;
      }
      for (const range of Object.values(this.props.ranges)) {
        const path_str = range['path']
          .map((x) => {
            if (typeof x === 'string') return `["${x}"]`;
            return `[${x}]`;
          })
          .join('');
        if (path_str === this.props.highlight.target) {
          this.prevSelectedDecoratorID = this.decorateRange(this.prevSelectedDecoratorID, range, 'selectedLines');
          if (this.props.highlight.source !== 'editor') this.editor.revealLineInCenter(range['startLine'] + 1);
          break;
        }
      }
    }
  }

  updateHover() {
    if (!this.props.hover) {
      return;
    }
    // check what the target should be from paths or ids
    let target: string;
    if (!this.props.hover.target) {
      if (this.props.hover.paths.length == 1) target = this.props.hover.paths[0];
      if (this.props.hover.ids.length == 1) {
        const target_id = this.props.hover.ids[0];
        for (const [key, ids] of Object.entries(this.props.view['mapping'] as Record<string, (number | string)[]>)) {
          if (ids.includes(target_id) || (!target_id.includes(':') && ids.includes(parseInt(target_id)))) {
            target = key;
          }
        }
      }
    }
    if (this.props.hover.selected) {
      this.prevHoverDecoratorID = this.decorateRange(
        this.prevHoverDecoratorID,
        {startLine: this.props.hover.selected.startLine, endLine: this.props.hover.selected.endLine},
        'hoveredLines'
      );
      return;
    }
    for (const range of Object.values(this.props.ranges)) {
      const path_str = range['path'].reduce((prev: string, curr: undefined) => {
        if (typeof curr === 'string') return prev + `["${curr}"]`;
        return prev + `[${curr}]`;
      }, '');
      if (path_str === this.props.hover.target || path_str === target) {
        this.prevHoverDecoratorID = this.decorateRange(this.prevHoverDecoratorID, range, 'hoveredLines');
        if (this.props.hover.source !== 'editor') this.editor.revealLineInCenter(range['startLine'] + 1);
        break;
      }
    }
  }

  decorateRange(decoratorID: string[], range: {startLine: number; endLine: number}, className: string): string[] {
    const endAdd = range.endLine === range.startLine ? 1 : 2;
    return this.editor.deltaDecorations(decoratorID, [
      {
        range: new Monaco.Range(range.startLine + 1, 1, range.endLine + endAdd, 1),
        options: {
          isWholeLine: true,
          className: className,
        },
      },
    ]);
  }

  public componentDidMount() {
    document.addEventListener('keydown', this.handleKeydown);
    if (this.props.sidePaneItem === SIDEPANE.Editor) {
      this.props.setEditorReference(this.editor);
    }
  }

  public componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  }

  public updateSpec(spec: string, config: string = undefined) {
    let parsedMode = this.props.mode;

    const schema = parseJSONC(spec).$schema;

    if (schema) {
      switch (parser(schema).library) {
        case 'vega-lite':
          parsedMode = Mode.VegaLite;
          break;
        case 'vega':
          parsedMode = Mode.Vega;
          break;
      }
    }

    switch (parsedMode) {
      case Mode.Vega:
        this.props.updateVegaSpec(spec, config);
        break;
      case Mode.VegaLite:
        this.props.updateVegaLiteSpec(spec, config);
        break;
      default:
        console.error(`Unknown mode:  ${parsedMode}`);
        break;
    }
  }

  public render() {
    return (
      <ResizeObserver
        onResize={({width, height}) => {
          this.editor.layout({width, height: height});
        }}
      >
        <MonacoEditor
          language="json"
          options={{
            cursorBlinking: 'smooth',
            folding: true,
            lineNumbersMinChars: 4,
            minimap: {enabled: false},
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            quickSuggestions: true,
          }}
          value={this.props.value}
          onChange={debounce(700, this.handleEditorChange)}
          editorWillMount={this.editorWillMount}
          editorDidMount={this.editorDidMount}
        />
      </ResizeObserver>
    );
  }
}

export default withRouter(Editor);

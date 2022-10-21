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
  public mouseDownHandler(event) {
    const line = event.target.position.lineNumber - 1;
    if (line in this.props.ranges) {
      const path = this.props.ranges[line].path;
      const path_str = path
        .map((x) => {
          if (typeof x === 'string') return `["${x}"]`;
          return `[${x}]`;
        })
        .join('');
      console.log(this.props.view, 'binidng');

      const mapping = this.props.view['mapping'];

      const to_highlight = [];
      for (const key in mapping) {
        if (key.includes(path_str)) to_highlight.push(...mapping[key]);
      }

      this.props.setHighlight({path: path_str, ids: to_highlight});
    }
  }

  public hoverHandler(lineNumber) {
    if (!lineNumber) this.props.setHighlight(null);
    const line = lineNumber - 1;
    if (line in this.props.ranges) {
      const path = this.props.ranges[line].path;
      const path_str = path
        .map((x) => {
          if (typeof x === 'string') return `["${x}"]`;
          return `[${x}]`;
        })
        .join('');
      console.log(this.props.view, 'binding');

      const mapping = this.props.view['mapping'];

      const to_highlight = [];
      for (const key in mapping) {
        if (key.includes(path_str)) to_highlight.push(...mapping[key]);
      }

      this.props.setHighlight({path: path_str, ids: to_highlight});
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

  public editorDidMount(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) {
    editor.onDidFocusEditorText(() => {
      this.props.compiledEditorRef && this.props.compiledEditorRef.deltaDecorations(this.props.decorations, []);
      editor.deltaDecorations(this.props.decorations, []);
      this.props.setEditorFocus(EDITOR_FOCUS.SpecEditor);
    });

    monaco.editor.defineTheme('my-theme', {
      base: 'vs',
      colors: {
        'editor.hoverHighlightBackground': '#00ff00',
      },
      rules: [],
      inherit: true,
    });

    monaco.editor.setTheme('my-theme');

    editor.onMouseDown(this.mouseDownHandler);

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

  public editorWillMount(monaco: typeof Monaco) {
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

  public componentDidUpdate(prevProps, prevState) {
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
      console.log(getFoldingRanges(textDocument));
      const hoverRanges = getFoldingRanges(textDocument);
      const startLine_to_range = {};
      hoverRanges.map((x) => (startLine_to_range[x.startLine] = x));
      console.log(startLine_to_range);
      this.props.setRanges(startLine_to_range);
      console.log(this.props.ranges, 'ranges??');
      console.log(this.props.view, 'view??');
      const setHover = this.hoverHandler;

      this.hover = Monaco.languages.registerHoverProvider('json', {
        provideHover(model, position) {
          console.log(position);
          if (position.lineNumber - 1 in startLine_to_range) {
            const selected = startLine_to_range[position.lineNumber - 1];
            const path_str = selected.path.map((x) => {
              if (typeof x === 'string') {
                return `['${x}']`;
              }
              return `[${x}]`;
            });
            setHover(position.lineNumber);
            return {
              range: new Monaco.Range(
                selected.startLine,
                model.getLineMaxColumn(selected.startLine),
                selected.endLine + 1,
                model.getLineMaxColumn(selected.endLine + 1)
              ),
              contents: [{value: '**JSON Property Path**'}, {value: path_str.join('')}],
            };
          } else {
            setHover(null);
          }
        },
      });
    }

    if (this.props.parse) {
      this.editor.focus();
      this.editor.layout();
      this.updateSpec(this.props.value, this.props.configEditorString);
      prevProps.parseSpec(false);
    }
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

'use babel';

import { CompositeDisposable } from 'atom';
import osc from './osc';
import dgram from 'dgram';

import atomiix from '@atomiix/atomiix';

import ConsoleView from './console';
import AtomiixHelp from './help';
import { handleActions } from './editorActions';
import { readProject, setupOSCMessage } from './project';
import translations from './translations';

export default {
  started: false,
  subscriptions: null,
  outSocket: null,
  inSocket: null,
  console: null,
  help: null,
  atomiixState: null,
  editorState: {
    buffer: null,
    textMarks: {},
  },

  config: {
    defaultProject: {
      title: 'Default project path',
      type: 'string',
      default: '~/atomiix/default',
      description: 'The path to the default project folder',
    },
    onlyDefaultProject: {
      title: 'Default project only',
      type: 'boolean',
      default: false,
      description: 'Should atom only use the default Atomiix project files',
    },
    language: {
      title: 'Improviz translation language',
      type: 'string',
      default: 'english',
      description: 'Choose which language Improviz uses',
    },
    onlyShowLogWhenErrors: {
      type: 'boolean',
      default: false,
      description: 'Only show console if last message was an error.',
    },
    onlyLogLastMessage: {
      type: 'boolean',
      default: false,
      description: 'Only log last message to the console.',
    },
    logOSCEvents: {
      type: 'boolean',
      default: false,
      description: 'Log info about OSC messages to the console',
    },
    consoleMaxHeight: {
      type: 'integer',
      default: 100,
      description: 'The console maximum height in pixels.',
    },
    scHost: {
      title: 'SuperCollider host',
      type: 'string',
      default: 'localhost',
      description: 'The SuperCollider host machine',
    },
    scPort: {
      title: 'SuperCollider port',
      type: 'integer',
      default: 57120,
      description: 'The port to send to SuperCollider on',
    },
    incomingPort: {
      title: 'Incoming port',
      type: 'integer',
      default: 57121,
      description: 'The port to listen for OSC messages on',
    },
  },

  activate() {
    this.console = new ConsoleView();
    this.help = new AtomiixHelp();

    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.commands.add('atom-workspace', {
        'atomiix:start': () => this.start(),
      })
    );
    this.subscriptions.add(
      atom.commands.add('atom-text-editor', {
        'atomiix:evaluate': () => this.evaluate(),
        'atomiix:freeAgent': () => this.freeAgent(),
      })
    );
  },

  deactivate() {
    this.subscriptions.dispose();
    if (this.started) {
      this.outSocket.close();
      this.inSocket.close();
      this.console.destroy();
    }
  },

  start() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      // TODO handle this in some useful fashion?
      return;
    }
    this.started = true;

    const language = atom.config.get('atomiix.language');
    this.translation = translations[language] || translations.english;

    this.console.initUI();

    this.console.logStdout(this.translation.info.startup);

    this.atomiixState = atomiix.init(
      {
        info: this.console.logStdout,
        warn: this.console.logStderr,
        error: this.console.logStderr,
      },
      language
    );

    this.editorState.buffer = editor.getBuffer();

    this.outSocket = dgram.createSocket('udp4');

    this.inSocket = this.setupOSCListener(
      this.atomiixState,
      this.editorState,
      this.outSocket,
      this.console
    );

    const projectPath = readProject(atom.project, this.editorState.buffer);
    console.log('projectPath', projectPath);
    this.console.logStdout(this.translation.info.loadingProject(projectPath));
    this.sendMessage(
      this.outSocket,
      setupOSCMessage(projectPath),
      this.console
    );
  },

  evaluate() {
    if (!this.started) {
      throw new Error('Atomiix not started');
    }
    const { text, firstLine, lastLine } = getProgramText();
    // Add 1 to these because buffer lines start at 0 but users see lines starting at 1
    this.console.logStdout(
      this.translation.info.interpreting(firstLine + 1, lastLine + 1)
    );
    const actions = atomiix.evaluate(this.atomiixState, text, firstLine);
    if (actions.audio.length > 0) {
      this.sendMessage(
        this.outSocket,
        atomiix.actionsToOSCBundle(actions.audio),
        this.console
      );
    }
    if (actions.editor.length > 0) {
      handleActions(this, this.editorState, actions.editor);
    }
  },

  freeAgent() {
    const { text, firstLine, lastLine } = getProgramText();
    this.console.logStdout(
      this.translation.info.interpreting(firstLine, lastLine)
    );
    const actions = atomiix.free(this.atomiixState, text);
    if (actions.audio.length > 0) {
      this.sendMessage(
        this.outSocket,
        atomiix.actionsToOSCBundle(actions.audio),
        this.console
      );
    }
    if (actions.editor.length > 0) {
      handleActions(this, this.editorState, actions.editor);
    }
  },

  sendMessage(outSocket, bundle) {
    const host = atom.config.get('atomiix.scHost');
    const port = atom.config.get('atomiix.scPort');
    const msg = osc.toBuffer(bundle);
    outSocket.send(msg, 0, msg.length, port, host, () => {
      if (atom.config.get('atomiix.logOSCEvents')) {
        this.console.logStdout(this.translation.info.oscSent);
      }
    });
  },

  setupOSCListener(state, editorState, outSocket) {
    const inPort = atom.config.get('atomiix.incomingPort');

    const sock = dgram.createSocket('udp4', msg => {
      if (atom.config.get('atomiix.logOSCEvents')) {
        this.console.logStdout(this.translation.info.oscRecv);
      }
      try {
        const incoming = atomiix.oscToAction(osc.fromBuffer(msg));
        const actions = atomiix.incomingAction(state, incoming);
        if (actions.audio.length > 0) {
          this.sendMessage(
            outSocket,
            atomiix.actionsToOSCBundle(actions.audio)
          );
        }
        if (actions.editor.length > 0) {
          handleActions(this, editorState, actions.editor);
        }
      } catch (err) {
        console.log(err);
        this.console.logStderr(this.translation.errors.invalidOSC);
      }
    });

    sock.bind(inPort);
    return sock;
  },
};

// Get the selected rows in any selection, otherwise get the line the cursor is on
function getProgramText() {
  let output = {
    text: '',
    firstLine: 0,
    lastLine: 0,
  };
  const editor = atom.workspace.getActiveTextEditor();
  if (!editor) {
    return output;
  }
  const range = editor.getSelectedBufferRange();
  if (range.isEmpty()) {
    const point = editor.getCursorBufferPosition();
    output.text = editor.lineTextForBufferRow(point.row);
    output.firstLine = point.row;
    output.lastLine = point.row;
  } else {
    range.start.column = 0;
    range.end.column = editor.lineTextForBufferRow(range.end.row).length;
    output.text = editor.getTextInBufferRange(range);
    console.log(range.start, range.end);
    output.firstLine = range.start.row;
    // if you select the entirety of a line, then it seems atom puts the
    // end of the range at the very first character on the next line.
    // presumably due to including the newline at the end
    if (range.end.column === 0) {
      output.lastLine = range.end.row - 1;
    } else {
      output.lastLine = range.end.row;
    }
  }
  return output;
}

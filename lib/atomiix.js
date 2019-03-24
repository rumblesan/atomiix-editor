'use babel';

import { CompositeDisposable } from 'atom';
import osc from 'osc-min';
import dgram from 'dgram';

import atomiix from '@atomiix/atomiix';

import ConsoleView from './console';
import {handleActions} from './editorActions';
import {readProject, setupOSCMessage} from './project';

export default {

  started: false,
  subscriptions: null,
  outSocket: null,
  inSocket: null,
  console: null,
  atomiixState: null,
  editorState: {
    buffer: null,
    textMarks: {},
  },

  config: {
    'defaultProject': {
      title: 'The path to the default project folder',
      type: 'string',
      default: '~/atomiix/default'
    },
    'onlyDefaultProject': {
      title: 'Should atom only use the default Atomiix project files',
      type: 'boolean',
      default: false
    },
    'onlyShowLogWhenErrors': {
      type: 'boolean',
      default: false,
      description: 'Only show console if last message was an error.'
    },
    'onlyLogLastMessage': {
      type: 'boolean',
      default: false,
      description: 'Only log last message to the console.'
    },
    'consoleMaxHeight': {
      type: 'integer',
      default: 100,
      description: 'The console maximum height in pixels.'
    },
    'scHost':  {
      title: 'The SuperCollider host machine',
      type: 'string',
      default: 'localhost'
    },
    'scPort':  {
      title: 'The port to send to SuperCollider on',
      type: 'integer',
      default: 57120
    },
    'incomingPort': {
      title: 'The port to listen for OSC messages on',
      type: 'integer',
      default: 57121
    }
  },

  activate() {
    this.console = new ConsoleView();

    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atomiix:start': () => this.start()
    }));
    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'atomiix:evaluate': () => this.evaluate(),
      'atomiix:freeAgent': () => this.freeAgent()
    }));

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
    this.started = true;

    this.console.initUI();

    this.atomiixState = atomiix.init({
      info: this.console.logStdout,
      warn: this.console.logStderr,
      error: this.console.logStderr,
    });

    const editor = atom.workspace.getActiveTextEditor();
    this.editorState.buffer = editor.getBuffer();

    this.outSocket = dgram.createSocket('udp4');

    this.inSocket = setupOSCListener(
      this.atomiixState, this.editorState, this.outSocket, this.console
    );

    const projectPath = readProject(atom.project);
    sendMessages(this.outSocket, [setupOSCMessage(projectPath)], this.console);
  },

  evaluate() {
    const {text, line} = getProgramText();
    this.console.logStdout(`Interpreting starting on line ${line}`);
    const actions = atomiix.evaluate(this.atomiixState, text, line);
    sendMessages(this.outSocket, atomiix.actionToOSC(actions.audio), this.console);
    handleActions(this.editorState, actions.editor);
  },

  freeAgent() {
    const {text, line} = getProgramText();
    this.console.logStdout(`Freeing agents starting on line ${line}`);
    const actions = atomiix.free(this.atomiixState, text);
    sendMessages(this.outSocket, atomiix.actionToOSC(actions.audio), this.console);
    handleActions(this.editorState, actions.editor);
  },
};

// Get the selected rows in any selection, otherwise get the line the cursor is on
function getProgramText() {
  let output = {
    text: '',
    line: 0,
  };
  const editor = atom.workspace.getActiveTextEditor();
  if (!editor) {
    return output;
  }
  const range = editor.getSelectedBufferRange();
  if (range.isEmpty()) {
    const point = editor.getCursorBufferPosition();
    output.text = editor.lineTextForBufferRow(point.row);
    output.line = point.row;
  } else {
    range.start.column = 0;
    range.end.column = editor.lineTextForBufferRow(range.end.row).length;
    output.text = editor.getTextInBufferRange(range);
    output.line = range.start.row;
  }
  return output;
}

function sendMessages(outSocket, messages, console) {
  const host = atom.config.get('atomiix.scHost');
  const port = atom.config.get('atomiix.scPort');
  messages.forEach(m => {
    const msg = osc.toBuffer(m);
    outSocket.send(msg, 0, msg.length, port, host, () => {
      console.logStdout('OSC message sent to SuperCollider');
    });
  });
}

function setupOSCListener(state, editorState, outSocket, console) {
  const inPort = atom.config.get('atomiix.incomingPort');

  const sock = dgram.createSocket('udp4', function(msg) {
    console.logStdout('Incoming OSC');
    try {
      const incoming = atomiix.oscToAction(osc.fromBuffer(msg));
      const actions = atomiix.incomingAction(state, incoming);
      sendMessages(outSocket, atomiix.actionToOSC(actions.audio));
      handleActions(editorState, actions.editor);
    } catch (err) {
      console.logStderr('invalid OSC packet', err);
    }
  });

  sock.bind(inPort);
  return sock;
}

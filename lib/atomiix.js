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
      title: 'Default project path',
      type: 'string',
      default: '~/atomiix/default',
      description: 'The path to the default project folder',
    },
    'onlyDefaultProject': {
      title: 'Default project only',
      type: 'boolean',
      default: false,
      description: 'Should atom only use the default Atomiix project files',
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
      title: 'SuperCollider host',
      type: 'string',
      default: 'localhost',
      description: 'The SuperCollider host machine',
    },
    'scPort':  {
      title: 'SuperCollider port',
      type: 'integer',
      default: 57120,
      description: 'The port to send to SuperCollider on',
    },
    'incomingPort': {
      title: 'Incoming port',
      type: 'integer',
      default: 57121,
      description: 'The port to listen for OSC messages on',
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

    this.console.logStdout('Starting Atomiix');

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

    const projectPath = readProject(atom.project, this.editorState.buffer);
    this.console.logStdout(`Loading project files from ${projectPath}`);
    sendMessages(this.outSocket, [setupOSCMessage(projectPath)], this.console);
  },

  evaluate() {
    const {text, firstLine, lastLine} = getProgramText();
    if (firstLine === lastLine) {
      this.console.logStdout(`Interpreting code on line ${firstLine}`);
    } else {
      this.console.logStdout(`Interpreting code on lines ${firstLine} to ${lastLine}`);
    }
    const actions = atomiix.evaluate(this.atomiixState, text, firstLine);
    sendMessages(this.outSocket, atomiix.actionToOSC(actions.audio), this.console);
    handleActions(this.editorState, actions.editor);
  },

  freeAgent() {
    const {text, firstLine, lastLine} = getProgramText();
    if (firstLine === lastLine) {
      this.console.logStdout(`Interpreting code on line ${firstLine}`);
    } else {
      this.console.logStdout(`Interpreting code on lines ${firstLine} to ${lastLine}`);
    }
    const actions = atomiix.free(this.atomiixState, text);
    sendMessages(this.outSocket, atomiix.actionToOSC(actions.audio), this.console);
    handleActions(this.editorState, actions.editor);
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
    output.firstLine = point.row + 1;
    output.lastLine = point.row + 1;
  } else {
    range.start.column = 0;
    range.end.column = editor.lineTextForBufferRow(range.end.row).length;
    output.text = editor.getTextInBufferRange(range);
    console.log(range.start, range.end);
    output.firstLine = range.start.row + 1;
    // if you select the entirety of a line, then it seems atom puts the
    // end of the range at the very first character on the next line.
    // presumably due to including the newline at the end
    if (range.end.column === 0) {
      output.lastLine = range.end.row;
    } else {
      output.lastLine = range.end.row + 1;
    }
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
      sendMessages(outSocket, atomiix.actionToOSC(actions.audio), console);
      handleActions(editorState, actions.editor);
    } catch (err) {
      console.logStderr('Invalid OSC packet', err);
    }
  });

  sock.bind(inPort);
  return sock;
}

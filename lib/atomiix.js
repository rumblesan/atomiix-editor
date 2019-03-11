'use babel';

import { CompositeDisposable } from 'atom';
import osc from 'osc-min';
import dgram from 'dgram';

import atomiix from '@atomiix/atomiix';

export default {

  subscriptions: null,
  socket: null,
  atomiixState: atomiix.init(),

  config: {
    'atomiixHost':  {
      type: 'string',
      default: 'localhost'
    },
    'atomiixPort':  {
      type: 'integer',
      default: 57120
    }
  },

  activate(state) {
    this.sock = dgram.createSocket('udp4');

    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atomiix:interpret': () => this.interpret()
    }));
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atomiix:freeAgent': () => this.freeAgent()
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
    this.sock.close();
  },

  interpret() {
    const {text, line} = getProgramText()
    console.log(`Interpreting ${text} starting on line ${line}`);
    const { messages, actions } = atomiix.evaluate(this.atomiixState, text, line);
    handleMessages(this.sock, messages);
    handleActions(actions);
  },

  freeAgent() {
    const {text, line} = getProgramText()
    console.log(`Freeing agents in ${text} starting on line ${line}`);
    const { messages, actions } = atomiix.free(this.atomiixState, text);
    handleMessages(this.sock, messages);
    handleActions(actions);
  },
};

// Get the selected rows in any selection, otherwise get the line the cursor is on
function getProgramText() {
  let editor
  let output = {
    text: '',
    line: 0,
  };
  if (editor = atom.workspace.getActiveTextEditor()) {
    const range = editor.getSelectedBufferRange();
    if (range.isEmpty()) {
      const point = editor.getCursorBufferPosition()
      output.text = editor.lineTextForBufferRow(point.row);
      output.line = point.row;
    } else {
      console.log('range', range.start.row, range.start.column, range.end.row, range.end.column);
      range.start.column = 0;
      range.end.column = editor.lineTextForBufferRow(range.end.row).length;
      console.log(range);
      output.text = editor.getTextInBufferRange(range);
      output.line = range.start.row;
    }
  }
  return output;
}

function handleMessages(sock, messages) {
  const host = atom.config.get('atomiix.atomiixHost');
  const port = atom.config.get('atomiix.atomiixPort');
  messages.forEach(m => {
    const msg = osc.toBuffer(m);
    sock.send(msg, 0, msg.length, port, host, () => {
      console.log('sent to port');
    });
  });
}

function handleActions(actions) {
  actions.forEach(action => {
    console.log('action', action);
  });
}

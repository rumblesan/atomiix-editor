'use babel';

import { CompositeDisposable } from 'atom';
import osc from 'osc-min';
import dgram from 'dgram';

import atomiix from '@atomiix/atomiix';

export default {

  subscriptions: null,
  socket: null,
  interpreterState: atomiix.interpreter.createState(),

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
      'atomiix:send': () => this.send()
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
    this.sock.close();
  },

  send() {
    console.log('Running code');
    const text = getProgramText()
    console.log(text);
    const messages = parseProgramText(this.interpreterState, text);
    sendMessages(this.sock, messages);
  }
};

// Get the selected rows in any selection, otherwise get the line the cursor is on
function getProgramText() {
  let editor
  if (editor = atom.workspace.getActiveTextEditor()) {
    const range = editor.getSelectedBufferRange();
    if (range.isEmpty()) {
      const point = editor.getCursorBufferPosition()
      return editor.lineTextForBufferRow(point.row);
    }
    console.log('range', range.start.row, range.start.column, range.end.row, range.end.column);
    range.start.column = 0;
    range.end.column = editor.lineTextForBufferRow(range.end.row).length;
    console.log(range);
    return editor.getTextInBufferRange(range);
  }
  return '';
}

function parseProgramText(state, ptext) {
  const ast = atomiix.parser.parse(ptext);
  const { messages } = atomiix.interpreter.interpret(state, ast);
  return messages;
}

function sendMessages(sock, messages) {
  const host = atom.config.get('atomiix.atomiixHost');
  const port = atom.config.get('atomiix.atomiixPort');
  console.log(host, port);
  messages.map(m => {
    const msg = osc.toBuffer(m);
    sock.send(msg, 0, msg.length, port, host, () => {
      console.log('sent to port');
    });
  });
}

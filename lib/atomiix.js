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
    const ast = atomiix.parser.parse(text);
    const { messages } = atomiix.interpreter.interpret(this.interpreterState, ast, line);
    console.log(this.interpreterState);
    handleMessages(this.sock, messages);
  },

  freeAgent() {
    const {text} = getProgramText()
    console.log('Freeing agents', text);
    const ast = atomiix.parser.parse(text);
    const { messages } = atomiix.interpreter.freeAgents(this.interpreterState, ast);
    console.log(this.interpreterState);
    handleMessages(this.sock, messages);
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
    if (m.type === 'OSCMESSAGE') {
      const msg = osc.toBuffer(m);
      sock.send(msg, 0, msg.length, port, host, () => {
        console.log('sent to port');
      });
    } else if (m.type === 'EDITORACTION') {
      editorAction(m);
    } else {
      console.log(`${m.type} is not a valid message type`);
    }
  });
}

function editorAction(action) {
  console.log(action);
}

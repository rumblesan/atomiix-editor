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
    const messages = parseProgramText(this.interpreterState, text);
    sendMessages(this.sock, messages);
  }
};

function getProgramText() {
  let editor
  if (editor = atom.workspace.getActiveTextEditor()) {
    return editor.getText()
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

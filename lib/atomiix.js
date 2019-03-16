'use babel';

import { CompositeDisposable } from 'atom';
import osc from 'osc-min';
import dgram from 'dgram';

import atomiix from '@atomiix/atomiix';

const editorActions = atomiix.editorActions;

export default {

  subscriptions: null,
  socket: null,
  atomiixState: atomiix.init(),
  editorState: {
    textMarks: {},
  },

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
    handleActions(this.editorState.textMarks, actions);
  },

  freeAgent() {
    const {text, line} = getProgramText()
    console.log(`Freeing agents in ${text} starting on line ${line}`);
    const { messages, actions } = atomiix.free(this.atomiixState, text);
    handleMessages(this.sock, messages);
    handleActions(this.editorState.textMarks, actions);
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
      range.start.column = 0;
      range.end.column = editor.lineTextForBufferRow(range.end.row).length;
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
      console.log('OSC message sent to SuperCollider');
    });
  });
}


function markMovementCB(groupName, sectionName, mark) {

  return function (e) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      return;
    }
    const t = editor.getTextInBufferRange(mark.getBufferRange());
    const additionalSpaces = t.search(/\S/);
    const tail = mark.getTailBufferPosition();
    tail.column = tail.column + additionalSpaces
    mark.setTailBufferPosition(tail);
    console.log(groupName, sectionName, e, `>${t}<`);
  }
}

function handleActions(textMarks, actions) {
  const editor = atom.workspace.getActiveTextEditor();
  if (!editor) {
    return;
    console.log(`No active editor so ignoring text events`);
  }

  actions.forEach(action => {
    console.log(`Running editor action: ${action.actionType}`);
    if (action.actionType === editorActions.MARKTEXT) {
      const groupName = action.group;
      if (!textMarks[groupName]) {
        textMarks[groupName] = {};
      }
      Object.keys(action.sections).forEach(sectionName => {
        const {line, start, finish} = action.sections[sectionName];
        const mark = editor.markBufferRange([[line, start], [line, finish]]);

        if (textMarks[groupName][sectionName]) {
          // Creating a new mark, so destroy the old one
          textMarks[groupName][sectionName].destroy();
        }
        textMarks[groupName][sectionName] = mark;
        mark.onDidChange(markMovementCB(groupName, sectionName, mark));
      });
    } else if (action.actionType === editorActions.UNMARKTEXT) {
      const groupName = action.group;
      if (!textMarks[groupName]) {
        // TODO warning?
        return;
      }
      Object.keys(textMarks[groupName]).forEach(sectionName => {
        textMarks[groupName][sectionName].destroy();
      });
      delete textMarks[groupName];
    } else if (action.actionType === editorActions.REPLACETEXT) {
      const groupName = action.group;
      if (!textMarks[groupName]) {
        // TODO warning?
        return;
      }
      Object.keys(action.sections).forEach(sectionName => {
        const newValue = action.sections[sectionName];
        const existingMark = textMarks[groupName][sectionName];

        const newRange = editor.setTextInBufferRange(existingMark.getBufferRange(), newValue);

        const newMark = editor.markBufferRange(newRange);
        existingMark.destroy();
        textMarks[groupName][sectionName] = newMark;
        newMark.onDidChange(markMovementCB(groupName, sectionName, newMark));
      });
    }
  });
}

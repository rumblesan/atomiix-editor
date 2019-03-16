'use babel';

import atomiix from '@atomiix/atomiix';

const editorActions = atomiix.editorActions;

export function handleActions(textMarks, actions) {
  const editor = atom.workspace.getActiveTextEditor();
  if (!editor) {
    console.log('No active editor so ignoring text events');
    return;
  }

  actions.forEach(action => {
    console.log(`Running editor action: ${action.actionType}`);
    switch (action.actionType) {
      case editorActions.MARKTEXT:
        markText(editor, action, textMarks);
        break;;
      case editorActions.UNMARKTEXT:
        unmarkText(editor, action, textMarks);
        break;;
      case editorActions.REPLACETEXT:
        replaceText(editor, action, textMarks);
        break;;
      case editorActions.REPLACELINE:
        replaceLine(editor, action);
        break;;
      default:
        console.log(`${action.actionType} is not a valid editor action`);
    }
  });
}

function markText(editor, action, textMarks) {
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
}

function unmarkText(editor, action, textMarks) {
  const groupName = action.group;
  if (!textMarks[groupName]) {
    // TODO warning?
    return;
  }
  Object.keys(textMarks[groupName]).forEach(sectionName => {
    textMarks[groupName][sectionName].destroy();
  });
  delete textMarks[groupName];
}

function replaceText(editor, action, textMarks) {
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

function replaceLine(editor, action) {
  const line = action.line;
  const text = action.text;
  const current = editor.lineTextForBufferRow(line);
  editor.setTextInBufferRange([[line, 0], [line, current.length]], text);
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
    tail.column = tail.column + additionalSpaces;
    mark.setTailBufferPosition(tail);
    console.log(groupName, sectionName, e, `>${t}<`);
  };
}

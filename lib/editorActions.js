'use babel';

import atomiix from '@atomiix/atomiix';

const editorActions = atomiix.editorActions;

export function handleActions({buffer, textMarks}, actions) {

  actions.forEach(action => {
    console.log(`Running editor action: ${action.actionType}`);
    switch (action.actionType) {
      case editorActions.MARKTEXT:
        markText(buffer, action, textMarks);
        break;;
      case editorActions.UNMARKTEXT:
        unmarkText(buffer, action, textMarks);
        break;;
      case editorActions.REPLACETEXT:
        replaceText(buffer, action, textMarks);
        break;;
      case editorActions.REPLACELINE:
        replaceLine(buffer, action);
        break;;
      default:
        console.log(`${action.actionType} is not a valid editor action`);
    }
  });
}

function markText(buffer, action, textMarks) {
  const groupName = action.group;
  if (!textMarks[groupName]) {
    textMarks[groupName] = {};
  }
  Object.keys(action.sections).forEach(sectionName => {
    const {line, start, finish} = action.sections[sectionName];
    const mark = buffer.markRange([[line, start], [line, finish]]);

    if (textMarks[groupName][sectionName]) {
      // Creating a new mark, so destroy the old one
      textMarks[groupName][sectionName].destroy();
    }
    textMarks[groupName][sectionName] = mark;
    mark.onDidChange(markMovementCB(groupName, sectionName, buffer, mark));
  });
}

function unmarkText(buffer, action, textMarks) {
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

function replaceText(buffer, action, textMarks) {
  const groupName = action.group;
  if (!textMarks[groupName]) {
    // TODO warning?
    return;
  }
  Object.keys(action.sections).forEach(sectionName => {
    const newValue = action.sections[sectionName];
    const existingMark = textMarks[groupName][sectionName];
    console.log('existing Mark', existingMark);
    console.log('existing mark range', existingMark.getRange());

    const newRange = buffer.setTextInRange(existingMark.getRange(), newValue);

    const newMark = buffer.markRange(newRange);
    existingMark.destroy();
    textMarks[groupName][sectionName] = newMark;
    newMark.onDidChange(markMovementCB(groupName, sectionName, buffer, newMark));
  });
}

function replaceLine(buffer, action) {
  const line = action.line;
  const text = action.text;
  const rowRange = buffer.rangeForRow(line);
  buffer.setTextInRange(rowRange, text);
}

function markMovementCB(groupName, sectionName, buffer, mark) {

  return function (e) {
    const tail = mark.getTailPosition();
    const head = mark.getHeadPosition();

    const t = buffer.getTextInRange(mark.getRange());
    const [tailSpaces] = t.match(/^\s*/);
    const [headSpaces] = t.match(/\s*$/);

    if (tailSpaces) {
      tail.column = tail.column + tailSpaces.length;
      mark.setTailPosition(tail);
    }
    if (headSpaces) {
      head.row = e.oldHeadPosition.row;
      head.column = e.oldHeadPosition.column;
      mark.setHeadPosition(head);
    }
  };
}

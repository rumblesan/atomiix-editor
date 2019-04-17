'use babel';

import atomiix from '@atomiix/atomiix';

const editorActions = atomiix.constants.editorActions;
const agentStates = atomiix.constants.agentStates;

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
      case editorActions.DISPLAYINFO:
        displayInfo(buffer, action);
        break;;
      case editorActions.DISPLAYAGENTSTATE:
        displayAgentState(buffer, action, textMarks);
        break;;
      case editorActions.FLASHMARKEDTEXT:
        flashMarkedText(buffer, action, textMarks);
        break;;
      default:
        console.log(`${action.actionType} is not a valid editor action`);
    }
  });
}

function displayAgentState(buffer, action, textMarks) {
  console.log('text marks', textMarks);
  const groupName = action.group;
  if (!textMarks[groupName]) {
    console.log(`${groupName} is not a known agent`);
    return;
  }
  const editor = atom.workspace.getActiveTextEditor();
  const mark = textMarks[groupName].sections.agent;

  let lineClass;
  switch (action.agentState) {
    case agentStates.PLAYING:
      lineClass = 'playing';
      break;
    case agentStates.STOPPED:
      lineClass = 'stopped';
      break;
    case agentStates.SLEEPING:
      lineClass = 'sleeping';
      break;
  }
  if (lineClass) {
    if (textMarks[groupName].decoration) {
      textMarks[groupName].decoration.destroy();
    }
    textMarks[groupName].decoration = editor.decorateMarker(mark, {type: 'line', class: lineClass});
  }
  console.log('state change', action);
}

function flashMarkedText(buffer, action, textMarks) {
  console.log('flash marked text', action);
  const groupName = action.group;
  if (!textMarks[groupName]) {
    console.log(`${groupName} is not a known agent`);
    return;
  }
  const editor = atom.workspace.getActiveTextEditor();
  const mark = textMarks[groupName].sections.future;
  if (textMarks[groupName].decoration) {
    textMarks[groupName].decoration.destroy();
  }
  const decoration = editor.decorateMarker(mark, {type: 'line', class: 'flash'});
  textMarks[groupName].decoration = decoration;
  var destroy = function () {
    decoration.destroy();
  };
  setTimeout(destroy, 120);
}

function markText(buffer, action, textMarks) {
  const groupName = action.group;
  if (!textMarks[groupName]) {
    textMarks[groupName] = {
      sections: {},
    };
  }
  Object.keys(action.sections).forEach(sectionName => {
    const {line, start, finish} = action.sections[sectionName];
    const mark = buffer.markRange([[line, start], [line, finish]]);

    if (textMarks[groupName].sections[sectionName]) {
      // Creating a new mark, so destroy the old one
      textMarks[groupName].sections[sectionName].destroy();
    }
    textMarks[groupName].sections[sectionName] = mark;
    mark.onDidChange(markMovementCB(groupName, sectionName, buffer, mark));
  });
  console.log('marked', textMarks);
}

function unmarkText(buffer, action, textMarks) {
  const groupName = action.group;
  if (!textMarks[groupName]) {
    // TODO warning?
    return;
  }
  Object.keys(textMarks[groupName]).forEach(sectionName => {
    console.log(textMarks[groupName]);
    textMarks[groupName].sections[sectionName].destroy();
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
    const existingMark = textMarks[groupName].sections[sectionName];
    console.log('existing Mark', existingMark);
    console.log('existing mark range', existingMark.getRange());

    const newRange = buffer.setTextInRange(existingMark.getRange(), newValue);

    const newMark = buffer.markRange(newRange);
    existingMark.destroy();
    textMarks[groupName].sections[sectionName] = newMark;
    newMark.onDidChange(markMovementCB(groupName, sectionName, buffer, newMark));
  });
}

function replaceLine(buffer, action) {
  const line = action.line;
  const text = action.text;
  const rowRange = buffer.rangeForRow(line);
  buffer.setTextInRange(rowRange, text);
}

function displayInfo(buffer, action) {
  const info = action.info;
  console.log(info);
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

'use babel';

import { Directory } from 'atom';

export function readProject(atomProject, buffer) {
  const defaultProjectPath = atom.config.get('atomiix.defaultProject');
  const [bufferProjectPath] = atom.project.relativizePath(buffer.file.path);
  if (bufferProjectPath === null) {
    return defaultProjectPath;
  }
  const projectDirectory = new Directory(bufferProjectPath);
  const projectFile = projectDirectory.getFile('atomiix.project');
  if (projectFile.existsSync()) {
    return bufferProjectPath;
  }
  return defaultProjectPath;
}

export function setupOSCMessage(projectPath) {
  return {
    oscType: 'message',
    address: '/setup',
    args: [{ type: 'string', value: projectPath }],
  };
}

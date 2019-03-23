'use babel';

export function readProject(atomProject) {
  let projectPath = atom.config.get('atomiix.defaultProject');
  const projectDirs = atomProject.getDirectories().filter(dir => dir.getFile('atomiix.project').exists());
  if (projectDirs.length > 0) {
    projectPath = projectDirs[0].getPath();
  }
  return projectPath;
}

export function setupOSCMessage(projectPath) {
  return {
    oscType: 'message',
    address: '/setup',
    args: [
      { type: 'string', value: projectPath },
    ],
  };
}

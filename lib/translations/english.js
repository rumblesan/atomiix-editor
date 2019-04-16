'use babel';

export default {
  info: {
    startup: 'Starting Atomiix',
    loadingProject: (projectPath) => `Loading project files from ${projectPath}`,
    oscSent: 'OSC message sent to SuperCollider',
    oscRecv: 'Incoming OSC',
    interpreting: (firstLine, lastLine) => {
      if (firstLine === lastLine) {
        return `Interpreting code on line ${firstLine}`;
      } else {
        return `Interpreting code on line ${firstLine} to ${lastLine}`;
      }
    },
  },
  errors: {
    invalidOSC: 'Invalid OSC packet',
  }
};

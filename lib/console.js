'use babel';
/* global document */

class ConsoleView {
  constructor() {
    this.atomiixConsole = null;
    this.log = null;
    this.serialize = this.serialize.bind(this);
    this.destroy = this.destroy.bind(this);
    this.logStdout = this.logStdout.bind(this);
    this.logStderr = this.logStderr.bind(this);
    this.logText = this.logText.bind(this);
  }

  initUI() {
    if (this.atomiixConsole) return;
    this.atomiixConsole = document.createElement('div');
    this.atomiixConsole.setAttribute('tabindex', -1);
    this.atomiixConsole.classList.add('atomiix', 'console', 'native-key-bindings');

    this.log = document.createElement('div');
    this.atomiixConsole.appendChild(this.log);

    atom.workspace.addBottomPanel({
      item: this.atomiixConsole
    });

    //sets the console max height
    this.atomiixConsole.setAttribute('style', 'max-height:'+
      atom.config.get('atomiix.consoleMaxHeight')+'px;');
    // listen for consoleMaxHeight changes
    atom.config.onDidChange( 'atomiix.consoleMaxHeight', (data) =>{
      this.atomiixConsole.setAttribute('style', 'max-height:'+
        data.newValue+'px;');
    });

  }

  serialize() {

  }

  destroy() {
    this.atomiixConsole.remove();
  }

  logStdout(text) {
    this.logText(text);
  }

  logStderr(text) {
    this.logText(text, true);
  }

  logText(text, error) {
    if (!text) return;
    var pre = document.createElement('pre');
    if (error) {
      pre.className = 'error';
    }

    if (atom.config.get('atomiix.onlyLogLastMessage')) {
      this.log.innerHTML = '';
    }
    pre.innerHTML = text;
    this.log.appendChild(pre);

    if (!error && atom.config.get('atomiix.onlyShowLogWhenErrors')) {
      this.atomiixConsole.classList.add('hidden');
    } else {
      this.atomiixConsole.classList.remove('hidden');
    }

    this.atomiixConsole.scrollTop = this.atomiixConsole.scrollHeight;


  }
}

export default ConsoleView;

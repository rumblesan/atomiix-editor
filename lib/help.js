'use babel';
/* global document */

class HelpView {
  constructor() {
    this.atomiixHelp = null;
    this.showHelp = this.showHelp.bind(this);
    this.serialize = this.serialize.bind(this);
    this.hideHelp = this.hideHelp.bind(this);
    this.display = this.display.bind(this);
  }

  showHelp() {
    if (this.atomiixHelp) return;
    this.atomiixHelp = document.createElement('div');
    this.atomiixHelp.setAttribute('tabindex', -1);
    this.atomiixHelp.classList.add('atomiix', 'help', 'native-key-bindings');

    this.help = document.createElement('div');
    this.atomiixHelp.appendChild(this.help);

    atom.workspace.addRightPanel({
      item: this.atomiixHelp
    });
  }

  serialize() {

  }

  hideHelp() {
    this.atomiixHelp.remove();
  }

  display(data) {
    data.forEach((line) => {
      const l = document.createElement('pre');
      const text = document.createTextNode(line);
      l.appendChild(text);
      this.help.appendChild(l);
    });
  }
}

export default HelpView;

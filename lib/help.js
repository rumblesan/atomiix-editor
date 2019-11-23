'use babel';

import HelpView from './help-view';

class AtomiixHelp {
  constructor() {
    this.helpView = new HelpView();
    this.helpPanel = atom.workspace.addRightPanel({
      item: this.helpView,
      visible: false,
    });
    this.helpView.setPanel(this.helpPanel);
  }

  display(info) {
    console.log('displaying help panel with info', info);
    if (!this.helpPanel.visible) {
      this.helpPanel.show();
    }
    this.helpView.update(info);
  }

  hide() {
    this.helpPanel.hide();
  }
};

export default AtomiixHelp;

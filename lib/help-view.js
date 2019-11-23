'use babel';

const etch = require('etch');
const $ = etch.dom;


class HelpView {
  constructor() {

    this.panel = null;

    this.info = '';

    etch.initialize(this);

    this.handleEvents();

  }

  update(updatedInfo) {
    this.info = updatedInfo;
    return etch.update(this);
  }

  render() {
    console.log('rendering help view');
    return (
      $.div({},
        $.div({},
          $.button({ref: 'closeButton', className: 'btn'}, 'Click')
        ),
        this.renderInfo(),
      )
    );
  }

  renderInfo() {
    if (Array.isArray(this.info)) {
      return $.ul({}, this.info.map(line => $.li({}, line)));
    } else {
      return $.pre({}, this.info);
    }
  }

  setPanel(panel) {
    this.panel = panel;
  }

  handleEvents() {
    this.refs.closeButton.addEventListener('click', () => {
      this.panel && this.panel.hide();
    });
  }

}

export default HelpView;

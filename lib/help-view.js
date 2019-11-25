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
    return (
      $.div({className: 'atomiix-help'},
        $.header({className: 'header'},
          $.span({
            ref: 'closeButton',
            className: 'header-item close-button pull-right',
          }, $.i({className: 'icon icon-x clickable'})),
          $.span({ref: 'descriptionLabel', className: 'header-item description'},
            'Help'
          ),
        ),
        $.section({className: 'help-info-block'},
          this.renderInfo(),
        )
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

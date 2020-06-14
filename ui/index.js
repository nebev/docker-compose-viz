const blessed = require('blessed');

/**
 * UI bootstrapping
 */
module.exports = (screen, title) => {
  const instructions = blessed.text({
    width: '100%',
    content: '[ESC: Quit] [U: Stack Up] [D: Stack Down]    [E: Enable/Disable] [X: Stop] [R: Remove] [S: Shell] [B: Build] [L: Logs]',
    align: 'left',
    bottom: 0,
  });
  screen.append(instructions);

  const header = blessed.box ({
    top: 0,
    border: 'line',
    content: title,
    left: 'center',
    align: 'center',
    height: 3,
    style: {
      fg: 'white',
    },
    width: '30%',
  });
  screen.append(header);

  const statusText = blessed.text({
    bottom: 0,
    right: 0,
    tags: true,
    content: '',
    align: 'right'
  });
  screen.append(statusText);

  const table = blessed.listtable({
    parent: screen,
    align: 'left',
    data: [],
    width: '100%',
    border: {
      type: 'line',
      fg: 'blue'
    },
    selectedBg: 'lightblue',
    selectedFg: 'white',
    selectedBold: 'true',
    clickable: true,
    mouse: false,
    noCellBorders: true,
    tags: true,
    top: 4,
    bottom: 2,
    style: {
      header: {
        fg: 'blue'
      },
      fg: 'white',
    },
    padding: {
      left: 1,
      right: 1
    }
  });
  screen.append(table);
  table.focus();

  return {
    table,
    instructions,
    header,
    statusText,
  };

};

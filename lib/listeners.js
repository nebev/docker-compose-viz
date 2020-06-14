'use strict';
const matchAll = require('match-all');
const screenFocus = 'base';

// Callback functions
const listeners = {
  build: [],
  down: [],
  enableToggle: [],
  exit: [],
  logs: [],
  remove: [],
  shell: [],
  stopContainer: [],
  up: [],
};

/**
 * @module listeners
 */

const blessedTagRegex = /{[^}]*}([^{]*){\/}/g;


exports.on = (listenerCode, callback) => {
  listeners[listenerCode].push(callback);
};

/**
 * Begin listening to UI elements
 * @param {module:blessed~screen} screen
 * @param {module:blessed~listtable} searchList
 * @param {Object} nameOverrides Name Map
 */
exports.listen = function (screen, searchList, nameOverrides) {

  /**
   * Gets the actual service name if it's been translated into something friendly
   * @param {string} nameFromTable Name from the table
   */
  const getActualServiceName = (nameFromTable) => {
    const nameKeys = Object.keys(nameOverrides);
    const tagMatch = matchAll(nameFromTable, blessedTagRegex).toArray();
    if (tagMatch && tagMatch.length > 0) {
      nameFromTable = tagMatch[0];
    }

    for (let nk of nameKeys) {
      if (nameOverrides[nk] === nameFromTable) {
        return nk;
      }
    }
    return nameFromTable;
  };

  /**
   * Sets up a listener for a table row
   * @param {Array<string>} keys Keys to listen to
   * @param {string} listenerKey Listener Key to send events to
   */
  const setupListenerForSelectedRow = (keys, listenerKey) => {
    screen.key(keys, () => {
      const item_index = searchList.selected;
      const row = searchList.rows[item_index];
      listeners[listenerKey].forEach((cb) => {
        cb(getActualServiceName(row[0]));
      });
    });
  };

  /**
   * Sets up global listener (not dependent on currently selected table)
   * @param {Array<string>} keys Keys to listen to
   * @param {string} listenerKey Listener Key to send events to
   */
  const setupGlobalListeners = (keys, listenerKey) => {
    screen.key(keys, () => {
      listeners[listenerKey].forEach((cb) => {
        cb();
      });
    });
  }

  // Table keys
  setupListenerForSelectedRow(['b'], 'build');
  setupListenerForSelectedRow(['e'], 'enableToggle');
  setupListenerForSelectedRow(['l'], 'logs');
  setupListenerForSelectedRow(['r'], 'remove');
  setupListenerForSelectedRow(['s'], 'shell');
  setupListenerForSelectedRow(['x'], 'stopContainer');

  // Global Keys
  setupGlobalListeners(['escape', 'C-c', 'q'], 'exit');
  setupGlobalListeners(['u'], 'up');
  setupGlobalListeners(['d'], 'down');

  // Navigation keys
  screen.key(['right', 'left', 'up', 'down'], function (ch, key) {
    if (screenFocus !== 'base') return;

    if (key.name === 'up') {
      if (searchList.selected === 1) {
        searchList.select(searchList.items.length);	// Go to the bottom
      } else {
        searchList.up(1);
      }
    } else if (key.name === 'down') {
      if (searchList.selected === searchList.items.length - 1) {
        searchList.select(1);
      } else {
        searchList.down(1);
      }
    }
    screen.render();
  });
};
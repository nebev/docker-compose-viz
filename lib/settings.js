const fs = require('fs');
const os = require('os');
const homedir = os.homedir();
const mkdirp = require('mkdirp');
const version = require('../version');

class Settings {
  constructor(basePath) {
    this.basePath = basePath || `${homedir}/.dcv`;
    this.configPath = `${this.basePath}/dcv.json`;
    this.localDirectory = process.cwd();
  }

  /**
   * Gets the settings for the specified Compose File Path
   * @param {string} composePath Full Filepath to Docker Compose File
   */
  async getComposeSettings(composePath) {
    const allSettings = await this._getConfig();
    if (!allSettings.composeFiles) { allSettings.composeFiles = {}; }
    if (allSettings.composeFiles[composePath]) {
      return allSettings.composeFiles[composePath];
    }
    return { services: {} };
  }

  /**
   * Toggles Services
   * @param {string} composePath The Compose File Path
   * @param {Array<string>} servicesToToggle Array of strings for services to toggle
   * @return Promise<Object> Updated Compose settings for the given file path
   */
  async toggleServices(composePath, servicesToToggle) {
    const currentSettings = await this.getComposeSettings(composePath);
    if (!('services' in currentSettings)) {
      currentSettings.services = {};
    }

    servicesToToggle.forEach((stt) => {
      if (!(stt in currentSettings.services)) {
        currentSettings.services[stt] = true;
      } else if (currentSettings.services[stt] === true) {
        currentSettings.services[stt] = false;
      } else {
        currentSettings.services[stt] = true;
      }
    });
    await this._writeComposeFileSettings(composePath, currentSettings);
    return currentSettings;
  }

  /**
   * Gets any name overrides in a key-value format if they're specified in the local override
   * @return Promise<Object>
   */
  async getNameOverrides() {
    const localOverrideExists = await this._hasSettingsOverride();
    if (localOverrideExists) {
      const localOverride = await this._getSettingsOverride();
      if (localOverride.names) {
        const allNames = Object.values(localOverride.names);
        const uniqueNames = Array.from(new Set(allNames));
        if (allNames.length !== uniqueNames.length) {
          console.error(`It appears you have duplicate service name aliases in your .dcv.json`);
          process.exit(1);
        }
        return localOverride.names;
      }
    }
    return {};
  }

  /**
   * Gets the compose file paths
   * @return Promise<string[]>
   */
  async getComposePath() {
    const localOverrideExists = await this._hasSettingsOverride();
    if (localOverrideExists) {
      const localOverride = await this._getSettingsOverride();
      if (localOverride.composePath) {
        const composeFilesToCheck = Array.isArray(localOverride.composePath) ? localOverride.composePath : [localOverride.composePath];
        for (let cctc of composeFilesToCheck) {
          const localOverrideComposePathExists = await this._fileExists(`${this.localDirectory}/${cctc}`);
          if (!localOverrideComposePathExists) {
            console.error(`Compose File specified in .dcv.json [${localOverride.composePath}] does not exist`);
            process.exit(1);
          }
        }
        return composeFilesToCheck.map(a => {
          return `${this.localDirectory}/${a}`;
        });
      }
    }
    const composeExistsInLocalDir = await this._fileExists(`${this.localDirectory}/docker-compose.yml`);
    if (!composeExistsInLocalDir) {
      console.error(`Cannot find docker-compose.yml in local directory`);
      console.error(`If you want to override the location of this file, you can create a .dcv.json in this directory`);
      process.exit(1);
    }
    return [`${this.localDirectory}/docker-compose.yml`];
  }

  /**
   * Gets the title to display
   * @return Promise<string>
   */
  async getTitle() {
    const localOverrideExists = await this._hasSettingsOverride();
    if (localOverrideExists) {
      const localOverride = await this._getSettingsOverride();
      if (localOverride.title) { return localOverride.title; }
    }
    return process.cwd().split('/').pop();
  }

  /**
   * Ensures that the config file exists
   */
  async _ensureConfigExists() {
    const configExists = await this._fileExists(this.configPath);
    if (!configExists) {
      const configDirExists = await this._fileExists(this.basePath);
      if (!configDirExists) {
        await mkdirp(this.basePath);
      }
      await this._writeConfig({
        composeFiles: {},
        version,
      });
    }
  }

  /**
   * Does a file exist?
   * @return Promise<boolean>
   */
  _fileExists(filePath) {
    return new Promise((resolve) => {
      fs.access(filePath, (err) => {
        resolve(!err);
      });
    });
  }

  /**
   * Writes settings for a given compose file
   * @param {string} composePath Compose Path
   * @param {Object} newSettings New Settings for compose file
   */
  async _writeComposeFileSettings(composePath, newSettings) {
    const allSettings = await this._getConfig();
    if (!allSettings.composeFiles) { allSettings.composeFiles = {}; }
    allSettings.composeFiles[composePath] = newSettings;
    await this._writeConfig(allSettings);
  }

  /**
   * Write the config
   * @param {Object} configFileContents Config Contents
   * @return Promise
   */
  _writeConfig(configFileContents) {
    return new Promise((resolve, reject) => {
      fs.writeFile(this.configPath, JSON.stringify(configFileContents, null, 2), 'utf8', (err) => {
        if (err) { return reject(err); }
        return resolve();
      });
    });
  }

  /**
   * Reads in the JSON from the config file as an object
   * @return Promise<Object>
   */
  async _getConfig() {
    await this._ensureConfigExists();
    return new Promise((resolve, reject) => {
      fs.readFile(this.configPath, (err, data) => {
        if (err) { return reject(err); }
        try {
          const fileContents = JSON.parse(data);
          return resolve(fileContents);
        } catch (e) {
          return reject(e);
        }
      });
    });
  }

  /**
   * Is there a settings override file in the current directory
   * @return Promise<boolean>
   */
  _hasSettingsOverride() {
    return this._fileExists(`${this.localDirectory}/.dcv.json`);
  }

  /**
   * Reads in the local directory settings override
   * @return Promise<Object>
   */
  async _getSettingsOverride() {
    return new Promise((resolve, reject) => {
      fs.readFile(`${this.localDirectory}/.dcv.json`, (err, data) => {
        if (err) { return reject(err); }
        try {
          const fileContents = JSON.parse(data);
          return resolve(fileContents);
        } catch (e) {
          return reject(e);
        }
      });
    });
  }

}

module.exports = Settings;

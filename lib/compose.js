const YAML = require('yaml');
const fs = require('fs');

/**
 * Interacts with Docker Compose YML files
 */
class Compose {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async parse() {
    const fileContents = await this._readFile();
    this.structure = YAML.parse(fileContents);
    if (!this.structure.services) {
      console.error(`The compose file specified has no services`);
      process.exit(1);
    }
  }

  async _readFile() {
    return new Promise((resolve, reject) => {
      fs.readFile(this.filePath, 'utf8', (err, data) => {
        if (err) { return reject(err); }
        return resolve(data);
      });
    });
  }

  getDefinition() {
    return this.structure;
  }

  /**
   * Writes a temporary docker-compose file
   * @param {string} path Filepath to write this to
   * @param {object} composeSettings Compose File Settings
   */
  writeTmpCompose(path, composeSettings) {
    const newComposeDef = JSON.parse(JSON.stringify(this.structure));

    // Remove any top level services
    Object.keys(newComposeDef.services).forEach((cs) => {
      if (!(cs in composeSettings.services) || composeSettings.services[cs] !== true ) {
        delete newComposeDef.services[cs];
      }
    });

    // Remove any depends on & links
    Object.keys(newComposeDef.services).forEach((cs) => {
      if (newComposeDef.services[cs].depends_on) {
        newComposeDef.services[cs].depends_on = newComposeDef.services[cs].depends_on.filter(a => {
          return a.split(':')[0] in newComposeDef.services;
        });
      }
      if (newComposeDef.services[cs].links) {
        newComposeDef.services[cs].links = newComposeDef.services[cs].links.filter(a => {
          return a.split(':')[0] in newComposeDef.services;
        });
      }
    });

    return new Promise((resolve, reject) => {
      fs.writeFile(path, YAML.stringify(newComposeDef), 'utf8', (err) => {
        if (err) { return reject(err); }
        return resolve();
      });
    });
  }

  /**
   * Cleanup temporary docker-compose file
   * @param {string} path Compose file to remove
   */
  cleanupTmpComposeFile(path) {
    if (!path.endsWith('_tmp_docker_compose_vis.yml')) {
      throw new Error('Cannot remove temp compose yml');
    }
    return new Promise((resolve, reject) => {
      fs.unlink(path, (err) => {
        if (err) { return reject(err); }
        return resolve();
      })
    });
  }

}

module.exports = Compose;

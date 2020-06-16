const YAML = require('yaml');
const fs = require('fs');

/**
 * Interacts with Docker Compose YML files
 */
class Compose {
  constructor(filePaths) {
    this.filePaths = filePaths;
  }

  /**
   * Parses all YML files in this.filePaths
   *   Works by combining all the services
   */
  async parse() {
    const allParsedFiles = [];
    for (let filePath of this.filePaths) {
      const fileContents = await this._readFile(filePath);
      const pf = YAML.parse(fileContents);
      if (!pf.services) {
        console.error(`The compose file specified has no services`);
        process.exit(1);
      }
      allParsedFiles.push(pf);
    }

    if (allParsedFiles.length === 1) {
      this.structure = allParsedFiles[0];
    } else {
      this.structure = allParsedFiles[0];
      allParsedFiles.slice(1).forEach((pf) => {
        Object.keys(pf.services).forEach(svcKey => {
          this.structure.services[svcKey] = pf.services[svcKey];
        });
      });
    }
  }

  async _readFile(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
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

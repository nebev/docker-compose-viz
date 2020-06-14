const moment = require('moment');

module.exports = {
  /**
   * Gets a list of what to display for the UI
   * @param {Object} composeDefinition Docker-Compose file in JS Object form
   * @param {Array<Object>} dockerContainers Array of current docker container's DATA (not full container ob)
   * @param {Array<Object>} dockerImages Array of all current Docker Images
   * @param {Object} enabledServiceList Key-Value array of enabled services. Key is compose service name, boolean as value
   * @param {Object} nameOverrides Key-Value list of name overrides for friendly names
   * @param {string} dirname The docker compose directory name (project) so we can accurately tell which containers belong to this project
   * @return {Promise<Object>} Keys [display] - suitable for display in blessed table, [info] { serviceName, container }
   */
  getList: async (composeDefinition, dockerContainers, dockerImages, enabledServiceList, nameOverrides, dirname) => {
    const headers = ['Component', 'Enabled', 'State', 'Last Built', 'Size'];
    const rows = [];
    const infoRows = [];

    Object.keys(composeDefinition.services).sort().forEach((serviceName) => {
      const adjustedServiceName = serviceName in nameOverrides ? nameOverrides[serviceName] : serviceName;
      const serviceEnabled = !!(enabledServiceList[serviceName]);

      const row = [
        serviceEnabled ? `{green-fg}${adjustedServiceName}{/}` : adjustedServiceName,
        serviceEnabled ? '✓' : ' ',
      ];
      const infoRow = { serviceName };

      // Is the container running?
      let containerStatus = '';
      let lastBuilt = '';
      let size = '';
      let selectedContainer = null;
      dockerContainers.forEach((container) => {
        if (container.Labels) {
          if(
            container.Labels['com.docker.compose.service'] === serviceName &&
            container.Labels['com.docker.compose.project'] === dirname
          ) {
            selectedContainer = container;
            containerStatus = `${container.State} - ${container.Status}`;
            const lastBuiltImage = dockerImages.find(a => a.Id === container.ImageID);
            if (lastBuiltImage) {
              lastBuilt = moment(new Date(lastBuiltImage.Created * 1000)).fromNow();
              size = `${(lastBuiltImage.Size / 1024 / 1024).toFixed(2)} MB`;
            }
          }
        }
      });
      row.push(containerStatus);
      row.push(lastBuilt);
      row.push(size);
      rows.push(row);

      infoRow.container = selectedContainer;
      infoRows.push(infoRow)
    });
    return {
      display: [
        headers,
        ...rows,
      ],
      info: infoRows,
    };
  },
};

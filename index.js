const {Docker} = require('node-docker-api');
const blessed = require('blessed');
const Compose = require('./lib/compose');
const UIHelpers = require('./ui/helper');
const Settings = require('./lib/settings');
const path = require('path');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });


(async () => {

  const settings = new Settings();
  let periodicTableRefreshTimeout;

  const baseComposeFilePath = await settings.getComposePath();
  const compose = new Compose(baseComposeFilePath);
  const nameOverrides = await settings.getNameOverrides();
  let composeFileSettings = await settings.getComposeSettings(baseComposeFilePath);
  await compose.parse();

  // If this is the first time, enable all services
  if (!composeFileSettings.services || Object.keys(composeFileSettings.services).length === 0) {
    composeFileSettings = await settings.toggleServices(baseComposeFilePath, Object.keys(compose.getDefinition().services));
  }

  /**
   * Gets table information suitable for display
   */
  const getTableInfo = async () => {
    const containers = await docker.container.list({ all: true });
    const images = await docker.image.list();
    return UIHelpers.getList(
      compose.getDefinition(),
      containers.map(a => a.data),
      images.map(a => a.data),
      composeFileSettings.services,
      nameOverrides,
      path.dirname(baseComposeFilePath[0]).split('/').pop(),
    );
  };

  /**
   * Re-Renders the table
   * @param {object} table Table Object
   */
  const renderTable = async (table) => {
    if (periodicTableRefreshTimeout) {
      clearTimeout(periodicTableRefreshTimeout);
      periodicTableRefreshTimeout = null;
    }
    const currentData = await getTableInfo();
    const idx = table.selected;
    table.setData(currentData.display);
    table.select(idx);
    screen.render();
    screen.emit('resize');
    periodicTableRefreshTimeout = setTimeout(() => {
      renderTable(table);
    }, 5000);
  };

  const screen = blessed.screen({
    fastCSR: true,
  });
  const titleText = await settings.getTitle();
  screen.title = titleText;
  
  const { table, statusText } = require('./ui')(screen, titleText);

  // Listeners
  const listeners = require('./lib/listeners');
  listeners.listen(screen, table, nameOverrides);

  /**
   * Gets the active/inactive Docker container object given a Docker Compose service
   * @param {string} serviceName Compose Service Name
   */
  const getContainer = async (serviceName) => {
    const ti = await getTableInfo();
    const correspondingContainer = (ti.info.find(a => a.serviceName === serviceName) || {}).container;
    if (correspondingContainer) {
      const allRealContainers = await docker.container.list({ all: true });
      const realContainer = allRealContainers.find(a => a.data.Id === correspondingContainer.Id);
      if (realContainer) {
        return realContainer;
      }
    }
    return false;
  }

  listeners.on('exit', () => process.exit(0));

  listeners.on('shell', async (serviceName) => {
    const container = await getContainer(serviceName);
    if (container) {
      screen.leave();
      const command = ['docker', 'exec', '-ti', container.data.Id, 'sh'];
      console.log(`Running ${command.join(' ')}`);
      const child = screen.spawn(command[0], command.slice(1));
      child.on('close', function () { });
    }
  });
  
  listeners.on('enableToggle', async (serviceName) => {
    composeFileSettings = await settings.toggleServices(baseComposeFilePath, [serviceName]);
    await renderTable(table);
  });

  listeners.on('remove', async (serviceName) => {
    const container = await getContainer(serviceName);
    if (container) {
      statusText.setContent(`{blue-bg}Removing Container{/}`);
      screen.render();
      await container.stop();
      await container.delete();
      statusText.setContent(``);
      await renderTable(table);
    }
  });

  listeners.on('stopContainer', async (serviceName) => {
    const container = await getContainer(serviceName);
    if (container) {
      statusText.setContent(`{blue-bg}Stopping Container{/}`);
      screen.render();
      await container.stop();
      statusText.setContent(``);
      await renderTable(table);
    }
  });

  listeners.on('up', async () => {
    const tmpComposePath = `${path.dirname(baseComposeFilePath[0])}/_tmp_docker_compose_vis.yml`;
    await compose.writeTmpCompose(
      tmpComposePath,
      composeFileSettings,
    );
    screen.leave();
    const command = ['docker-compose', '-f', tmpComposePath, 'up', '-d'];
    console.log(`Running ${command.join(' ')}`);
    const child = screen.spawn(command[0], command.slice(1));
    child.on('close', async (exitCode) => {
      if (exitCode !== 0) { process.exit(exitCode); }
      await compose.cleanupTmpComposeFile(tmpComposePath);
    });
  });

  listeners.on('down', async () => {
    const tmpComposePath = `${path.dirname(baseComposeFilePath[0])}/_tmp_docker_compose_vis.yml`;
    await compose.writeTmpCompose(
      tmpComposePath,
      composeFileSettings,
    );
    screen.leave();
    const command = ['docker-compose', '-f', tmpComposePath, 'down'];
    console.log(`Running ${command.join(' ')}`);
    const child = screen.spawn(command[0], command.slice(1));
    child.on('close', async (exitCode) => {
      if (exitCode !== 0) { process.exit(exitCode); }
      await compose.cleanupTmpComposeFile(tmpComposePath);
    });
  });

  listeners.on('logs', async (serviceName) => {
    const container = await getContainer(serviceName);
    if (container) {
      screen.leave();
      const command = ['docker', 'logs', '-f', container.data.Id, '--tail', '250'];
      console.log(`Running ${command.join(' ')}`);
      const child = screen.spawn(command[0], command.slice(1));
      child.on('close', async () => { process.exit(0); });
    }
    await renderTable(table);
  });

  listeners.on('build', async (serviceName) => {
    const tmpComposePath = `${path.dirname(baseComposeFilePath[0])}/_tmp_docker_compose_vis.yml`;
    await compose.writeTmpCompose(
      tmpComposePath,
      composeFileSettings,
    );
    screen.leave();
    const command = ['docker-compose', '-f', tmpComposePath, 'build', serviceName];
    console.log(`Running ${command.join(' ')}`);
    const child = screen.exec(command[0], command.slice(1));
    child.on('close', async (exitCode) => {
      if (exitCode !== 0) { process.exit(exitCode); }
      await compose.cleanupTmpComposeFile(tmpComposePath);
    });
  });

  await renderTable(table);
  screen.render();

  // Unhandled errors due to our terrible code
  process.on('unhandledRejection', (err) => {
    if (screen) { screen.destroy(); }
    console.error(err);
    process.exit(1);
  });
  
  process.on('uncaughtException', (err) => {
    if (screen) { screen.destroy(); }
    console.error(err);
    process.exit(1);
  });
})();


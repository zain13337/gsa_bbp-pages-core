const buildTaskTypeFactory = require('./build-task-type');
const siteFactory = require('./site');

const { SiteBuildTask } = require('../../../../api/models');

// eslint-disable-next-line no-underscore-dangle
const _attributes = ({
  siteId, buildTaskTypeId, branch, metadata,
} = {}) => ({
  siteId: siteId || siteFactory(),
  buildTaskTypeId: buildTaskTypeId || buildTaskTypeFactory(),
  branch: branch || null,
  metadata: metadata || { some: 'metadata' },
});

const siteBuildTask = overrides => Promise.props(_attributes(overrides))
  .then((attributes) => {
    Object.keys(attributes).forEach((key) => {
      if (attributes[key]?.sequelize) {
        // eslint-disable-next-line no-param-reassign
        attributes[key] = attributes[key].id;
      }
    });
    return SiteBuildTask.create(attributes);
  });

module.exports = siteBuildTask;

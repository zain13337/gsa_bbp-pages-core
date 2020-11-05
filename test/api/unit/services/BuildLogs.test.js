const { expect } = require('chai');
const sinon = require('sinon');
const factory = require('../../support/factory');

const { BuildLog } = require('../../../../api/models');
const BuildLogs = require('../../../../api/services/build-logs/build-logs');

describe('BuildLogs Service', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('.buildKey', () => {
    const site1 = { owner: 'owner1', repository: 'repo1' };
    const site2 = { owner: 'owner2', repository: 'repo2' };
    const build1 = { id: 111 };
    const build2 = { id: 222 };

    it('is a string', () => {
      const result = BuildLogs.buildKey(site1, build1);
      expect(result).to.be.a('string');
    });

    it('is unique per site and build', () => {
      const [a, b, c, d] = [
        BuildLogs.buildKey(site1, build1),
        BuildLogs.buildKey(site1, build2),
        BuildLogs.buildKey(site2, build1),
        BuildLogs.buildKey(site1, build1),
      ];

      expect(a).to.not.equal(b);
      expect(b).to.not.equal(c);
      expect(a).to.not.equal(c);
      expect(a).to.equal(d);
    });
  });

  describe('.fetchBuildLogs', () => {
    it('returns the logs as one string', async () => {
      const numLogs = 100;
      const build = await factory.build();
      await factory.bulkBuildLogs(numLogs, { buildId: build.id, output: 'Foobarbaz' });

      const { logs: logStr } = await BuildLogs.fetchBuildLogs(build);

      expect(logStr).to.be.a('string');
      expect(logStr.split('\n').length).to.equal(numLogs);

      const matches = [...logStr.matchAll(/Foobarbaz/g)];
      expect(matches.length).to.equal(numLogs);
    });

    describe('when there are no logs', () => {
      it('returns null', async () => {
        const build = await factory.build();

        const { logs: logStr } = await BuildLogs.fetchBuildLogs(build);

        expect(logStr).to.be.null;
      });
    });
  });

  describe('.archiveBuildLogs', () => {
    let putObjectStub;

    beforeEach(() => {
      putObjectStub = sinon.stub();
      putObjectStub.resolves();
      sinon.stub(BuildLogs, 's3').returns({
        putObject: putObjectStub,
      });
    });

    it('does all the things', async () => {
      const site = await factory.site();
      const build = await factory.build({ site });
      await factory.buildLog({ build: build.id, output: 'Foobarbaz' });
      const destroySpy = sinon.spy(BuildLog, 'destroy');

      // there should be 1 build log
      const numLogsBefore = await BuildLog.count({ where: { build: build.id } });
      expect(numLogsBefore).to.equal(1);

      const expectedKey = BuildLogs.buildKey(site, build);
      const expectedLogs = 'Foobarbaz';

      await BuildLogs.archiveBuildLogs(site, build);

      // sends logs to S3
      sinon.assert.calledOnceWithExactly(putObjectStub, expectedLogs, expectedKey);

      // updates the build
      await build.reload();
      expect(build.logsS3Key).to.equal(expectedKey);

      // deletes the logs
      sinon.assert.calledOnceWithExactly(destroySpy, { where: { build: build.id } });
      const numLogsAfter = await BuildLog.count({ where: { build: build.id } });
      expect(numLogsAfter).to.equal(0);
    });

    describe('when there are no logs', () => {
      it('does not do anything', async () => {
        const site = await factory.site();
        const build = await factory.build({ site });
        const destroySpy = sinon.spy(BuildLog, 'destroy');

        await BuildLogs.archiveBuildLogs(site, build);

        // does not send logs to S3
        sinon.assert.notCalled(putObjectStub);

        // does not update build
        await build.reload();
        expect(build.logsS3Key).to.be.null;

        // does not delete the logs
        sinon.assert.notCalled(destroySpy);
      });
    });
  });

  describe('.getBuildLogs', () => {
    let getObjectStub;

    beforeEach(() => {
      getObjectStub = sinon.stub();
      sinon.stub(BuildLogs, 's3').returns({
        getObject: getObjectStub,
      });
    });

    it('returns the byte range of the logs', async () => {
      const key = 'owner/repo/1';

      const build = { logsS3Key: key };
      getObjectStub.resolves(
        { Body: Buffer.from('hel') }
      );

      const result = await BuildLogs.getBuildLogs(build, 0, 2);

      sinon.assert.calledOnceWithExactly(getObjectStub, key, { Range: 'bytes=0-2' });
      expect(result).to.equal('hel');
    });

    it('returns null if range cannott be satisified', async () => {
      const key = 'owner/repo/1';

      const build = { logsS3Key: key };
      const error = new Error('foo');
      error.code = 'InvalidRange';
      getObjectStub.rejects(error);

      const result = await BuildLogs.getBuildLogs(build, 100, 199);

      sinon.assert.calledOnceWithExactly(getObjectStub, key, { Range: 'bytes=100-199' });
      expect(result).to.be.null;
    });
  });
});

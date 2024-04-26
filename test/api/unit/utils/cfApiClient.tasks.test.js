const { expect } = require('chai');
const sinon = require('sinon');
const CloudFoundryAPIClient = require('../../../../api/utils/cfApiClient');

describe('CloudFoundryAPIClient', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('.startSiteBuildTask', () => {
    const apiClient = new CloudFoundryAPIClient();

    it('should start a site build cf task with default settings', async () => {
      const guid = 123;
      const jobId = 456;
      const state = 'SUCCEEDED';
      const appName = 'pages-build-container-development';
      const message = {
        environment: [
          {
            name: 'BUILD',
            value: '1',
          },
        ],
      };
      const method = 'POST';
      const path = `/v3/apps/${guid}/tasks`;
      const commandParam = message.environment[0];
      const taskParams = {
        disk_in_mb: 4 * 1024,
        memory_in_mb: 2 * 1024,
        name: `build-${jobId}`,
        command: `cd app && python main.py -p '${JSON.stringify({
          [commandParam.name]: commandParam.value,
        })}'`,
        metadata: { labels: { type: 'build-task' } },
      };

      const stubFetchTaskAppGUID = sinon.stub(CloudFoundryAPIClient.prototype, 'fetchTaskAppGUID');
      stubFetchTaskAppGUID.resolves(guid);

      const stubAuthRequest = sinon.stub(CloudFoundryAPIClient.prototype, 'authRequest');
      stubAuthRequest.resolves({ state });

      const res = await apiClient.startSiteBuildTask(message, jobId);

      expect(res.state).to.equal('SUCCEEDED');
      sinon.assert.calledOnceWithExactly(stubFetchTaskAppGUID, appName);
      sinon.assert.calledOnceWithExactly(stubAuthRequest, method, path, taskParams);
    });

    it('should start a site build cf task with containerSize large settings', async () => {
      const guid = 123;
      const jobId = 456;
      const state = 'SUCCEEDED';
      const appName = 'pages-build-container-development';
      const message = {
        environment: [
          {
            name: 'BUILD',
            value: '1',
          },
        ],
        containerSize: 'large',
      };
      const method = 'POST';
      const path = `/v3/apps/${guid}/tasks`;
      const commandParam = message.environment[0];
      const taskParams = {
        disk_in_mb: 6 * 1024,
        memory_in_mb: 2 * 1024,
        name: `build-${jobId}`,
        command: `cd app && python main.py -p '${JSON.stringify({
          [commandParam.name]: commandParam.value,
        })}'`,
        metadata: { labels: { type: 'build-task' } },
      };

      const stubFetchTaskAppGUID = sinon.stub(CloudFoundryAPIClient.prototype, 'fetchTaskAppGUID');
      stubFetchTaskAppGUID.resolves(guid);

      const stubAuthRequest = sinon.stub(CloudFoundryAPIClient.prototype, 'authRequest');
      stubAuthRequest.resolves({ state });

      const res = await apiClient.startSiteBuildTask(message, jobId);

      expect(res.state).to.equal('SUCCEEDED');
      sinon.assert.calledOnceWithExactly(stubFetchTaskAppGUID, appName);
      sinon.assert.calledOnceWithExactly(stubAuthRequest, method, path, taskParams);
    });

    it('should start a site build cf task on the third retry', async () => {
      const guid = 123;
      const jobId = 456;
      const state = 'SUCCEEDED';
      const appName = 'pages-build-container-development';
      const message = {
        environment: [
          {
            name: 'BUILD',
            value: '1',
          },
        ],
      };
      const method = 'POST';
      const path = `/v3/apps/${guid}/tasks`;
      const commandParam = message.environment[0];
      const taskParams = {
        disk_in_mb: 4 * 1024,
        memory_in_mb: 2 * 1024,
        name: `build-${jobId}`,
        command: `cd app && python main.py -p '${JSON.stringify({
          [commandParam.name]: commandParam.value,
        })}'`,
        metadata: { labels: { type: 'build-task' } },
      };

      const stubFetchTaskAppGUID = sinon.stub(CloudFoundryAPIClient.prototype, 'fetchTaskAppGUID');
      stubFetchTaskAppGUID.resolves(guid);

      const stubAuthRequest = sinon.stub(CloudFoundryAPIClient.prototype, 'authRequest');
      stubAuthRequest
        .onFirstCall()
        .rejects()
        .onSecondCall()
        .rejects()
        .onThirdCall()
        .resolves({ state });

      const res = await apiClient.startSiteBuildTask(message, jobId, { sleepInterval: 0 });

      expect(res.state).to.equal('SUCCEEDED');
      expect(stubAuthRequest.callCount).to.equal(3);
      sinon.assert.calledWithExactly(stubFetchTaskAppGUID, appName);
      sinon.assert.calledWithExactly(stubAuthRequest, method, path, taskParams);
    });
  });
});

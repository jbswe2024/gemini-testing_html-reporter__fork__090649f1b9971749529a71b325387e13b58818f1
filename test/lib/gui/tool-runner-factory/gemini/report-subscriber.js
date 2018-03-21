'use strict';

const reportSubscriber = require('lib/gui/tool-runner-factory/gemini/report-subscriber');
const ReportBuilder = require('lib/report-builder-factory/report-builder');
const {stubTool, stubConfig} = require('test/utils');

describe('lib/gui/tool-runner-factory/gemini/report-subscriber', () => {
    const sandbox = sinon.createSandbox();
    let reportBuilder;

    const events = {
        END_RUNNER: 'endRunner'
    };

    const mkGemini_ = () => stubTool(stubConfig(), events);

    beforeEach(() => {
        reportBuilder = sinon.createStubInstance(ReportBuilder);
        sandbox.stub(ReportBuilder, 'create').returns(reportBuilder);
    });

    afterEach(() => sandbox.restore());

    it('should save report', () => {
        const gemini = mkGemini_();
        reportSubscriber(gemini, reportBuilder);

        return gemini.emitAndWait(gemini.events.END_RUNNER)
            .then(() => assert.calledOnce(reportBuilder.save));
    });
});
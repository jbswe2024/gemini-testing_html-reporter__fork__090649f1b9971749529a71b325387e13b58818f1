'use strict';

import React from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import PropTypes from 'prop-types';
import * as actions from '../../../modules/actions';
import {mkGetTestsBySuiteId} from '../../../modules/selectors/tree';
import {getToggledCheckboxState} from '../../../../common-utils';
import Bullet from '../../bullet';
import {Button, ClipboardButton, Spin} from '@gravity-ui/uikit';
import {ArrowRotateLeft} from '@gravity-ui/icons';
import {TestStatus} from '../../../../constants';

const SectionTitle = ({name, suiteId, handler, gui, checkStatus, suiteTests, actions, running, runningThis}) => {
    const onCopySuiteName = (e) => {
        e.stopPropagation();

        actions.copySuiteName(suiteId);
    };

    const onSuiteRetry = (e) => {
        e.stopPropagation();

        actions.retrySuite(suiteTests);
    };

    const onToggleCheckbox = (e) => {
        e.stopPropagation();

        actions.toggleSuiteCheckbox({
            suiteId,
            checkStatus: getToggledCheckboxState(checkStatus)
        });
    };

    const drawCopyButton = () => (
        <ClipboardButton
            size='s'
            onClick={onCopySuiteName}
            title="copy to clipboard"
            text={suiteId}>
        </ClipboardButton>
    );

    const drawRetryButton = () => (
        runningThis ? <Spin size='xs'/> : <Button
            size='s'
            view='flat'
            title="retry suite"
            onClick={onSuiteRetry}
            disabled={running}>
            <Button.Icon>
                <ArrowRotateLeft/>
            </Button.Icon>
        </Button>
    );

    return (
        <div className="section__title" onClick={handler}>
            <Bullet status={checkStatus} onClick={onToggleCheckbox} />
            {name}
            {drawCopyButton()}
            {gui && drawRetryButton()}
        </div>
    );
};

SectionTitle.propTypes = {
    name: PropTypes.string.isRequired,
    suiteId: PropTypes.string.isRequired,
    handler: PropTypes.func.isRequired,
    // from store
    gui: PropTypes.bool.isRequired,
    checkStatus: PropTypes.number,
    suiteTests: PropTypes.arrayOf(PropTypes.shape({
        testName: PropTypes.string,
        browserName: PropTypes.string
    })).isRequired,
    running: PropTypes.bool,
    runningThis: PropTypes.bool,
    actions: PropTypes.object.isRequired
};

export default connect(
    () => {
        const getTestsBySuiteId = mkGetTestsBySuiteId();

        return (state, {suiteId}) => {
            return ({
                gui: state.gui,
                running: state.running,
                runningThis: state.tree.suites.byId[suiteId].status === TestStatus.RUNNING,
                checkStatus: state.tree.suites.stateById[suiteId].checkStatus,
                suiteTests: getTestsBySuiteId(state, {suiteId})
            });
        };
    },
    (dispatch) => ({actions: bindActionCreators(actions, dispatch)})
)(SectionTitle);
